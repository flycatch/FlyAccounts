# Research: Microsoft Authentication with RBAC

## Microsoft identity (organizational accounts only)

**Decision**: Frontend uses `@azure/msal-browser` against a single Entra ID tenant (`VITE_MICROSOFT_TENANT_ID` / `MICROSOFT_TENANT_ID`) and SPA client id (`VITE_MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_ID`). Authority is `https://login.microsoftonline.com/{tenantId}`. After interactive sign-in, the frontend sends the Microsoft ID token to `POST /v1/auth/microsoft`. The backend validates the token against Microsoft JWKS (`iss`, `aud`, `tid`, signature, expiry). Personal accounts and unknown tenants are rejected and MUST NOT create a User.

**Rationale**: FR-001, FR-002, FR-017. Microsoft proves identity only (spec Assumptions). A single-tenant authority is the smallest way to refuse personal Microsoft accounts. Validating the ID token on the backend keeps FlyAccounts from trusting the browser alone (constitution VII).

**Alternatives considered**: Backend-only authorization-code redirect (extra callback URL and session cookie, conflicts with the localStorage JWT request); multi-tenant + `acct` claim filtering (easier to miss a personal account); accepting Microsoft access tokens on every API call (no FlyAccounts refresh control, roles would still need a DB lookup). Rejected.

## Backend-issued JWT session

**Decision**: After a valid Microsoft ID token, the backend issues a short-lived **access JWT** (HMAC, `JWT_SIGNING_KEY`) and an **opaque refresh token**. Access JWT `sub` is the internal User UUID. Claims MUST NOT include roles or permissions. Default access TTL is 900 seconds (`JWT_ACCESS_TTL_SECONDS`). Protected routes send `Authorization: Bearer <accessToken>`. Combined permissions are loaded from PostgreSQL on every request.

**Rationale**: FR-020 requires the next request to use updated roles. Embedding roles in the JWT would keep stale permissions until expiry. A FlyAccounts JWT lets the API authorize without calling Microsoft on every request. HMAC with an env signing key is enough for a single backend (constitution I, VI).

**Alternatives considered**: Embed roles in the access JWT (violates FR-020 unless TTL is tiny and still races); opaque access tokens in the database on every call (extra round trip with no benefit over a signed JWT plus a role query); session cookies only (rejected by the localStorage requirement). Rejected.

## localStorage for tokens

**Decision**: The frontend stores `accessToken` and `refreshToken` in `localStorage` (keys `flyaccounts.accessToken` and `flyaccounts.refreshToken`). On load, if an access token is present and not expired, the person is treated as signed in. If the access token is missing or the API returns 401, the client calls `POST /v1/auth/refresh` and retries once. Sign-out removes both keys.

**Rationale**: Requested session persistence for the SPA. Page refresh must keep a signed-in person on pending access or the combined landing (spec edge case). Mitigations: short access TTL, refresh rotation, reuse detection, no secrets or permissions in the JWT payload, no dummy auth.

**Alternatives considered**: HttpOnly Secure cookies (stronger against XSS; rejected because this feature requires localStorage); memory-only access token (refresh would still need storage; a full refresh loses the session on reload). Rejected.

## Refresh token rotation

**Decision**: Refresh tokens are random opaque values. Only a SHA-256 hash is stored (`RefreshToken.token_hash`). `POST /v1/auth/refresh` accepts the raw token, looks up the hash, and if valid: issues a new access JWT and a new refresh token, marks the old row `revoked_at` / `replaced_by_id`, and returns the new pair. Default refresh TTL is 604800 seconds (`JWT_REFRESH_TTL_SECONDS`). Reuse of a already-rotated (or revoked) token revokes every row in that `family_id`. Expired or unknown tokens return 401 and MUST NOT issue a new pair. Logout revokes the presented refresh token (and preferably the family).

**Rationale**: FR-016 and session integrity. Rotation limits the window if `localStorage` is copied. Reuse detection treats a second redeem of an old token as theft. Hashing at rest matches constitution VII.

**Alternatives considered**: Non-rotating long-lived refresh (stolen token works until expiry); refresh JWT instead of opaque server-side tokens (harder to revoke a family); sliding cookies. Rejected.

## Default admin from environment

**Decision**: `INITIAL_ADMIN_EMAIL` is the organizational Microsoft work email of the first person who may assign roles. It lives in `deployment/.env`, with an empty or placeholder value in `deployment/.env.example`. On first successful Microsoft sign-in, trim and compare the env value **case-insensitively** to the ID token `preferred_username` (organizational UPN / work email) and, if present, the `email` claim. On match, and if the user has no RoleAssignment yet, assign the seeded role that already includes permission code `access_administration`. Lookup is by that permission on RolePermission data, not by a hardcoded role name in application logic. If the env value is missing or does not match, the signer is a User with no roles (pending access). The email MUST NOT appear in source. `User.microsoft_oid` remains the unique stored identity for upserts; only the bootstrap comparison uses email.

**Rationale**: FR-011, FR-018, constitution XII. Avoids dummy sign-in and first-admin lockout. Operators identify the first administrator by work email, which is what they can configure without looking up an Entra object id.

**Alternatives considered**: Match Microsoft `oid` (more stable if email/UPN changes; rejected because operators configure a work email); match UPN without case-folding (fails when casing differs); seed a password admin (violates FR-017); hardcode the admin email (violates FR-018); auto-grant admin to the first signer with no env (unsafe if the first signer is not intended). Rejected.

## Roles and permissions as data

**Decision**: Alembic revision `0002_auth_rbac` creates tables and **seeds** permission rows and four starter roles so assignment and the combined landing are testable. Runtime authorization checks permission **codes** loaded from the database (`access_administration`, `view_sensitive_financial_fields`, `finance_landing`, `hr_landing`, `pmo_landing`). Application code MUST NOT branch on role display names. This feature does not add APIs to create, rename, edit, or delete roles or permissions (FR-005).

**Seed (display names are data, not a closed enum in code):**

| Role (seed name) | Permission codes |
|------------------|------------------|
| Entity Admin | `access_administration` |
| Finance User | `view_sensitive_financial_fields`, `finance_landing` |
| HR User | `hr_landing` |
| PMO User | `pmo_landing` |

**Rationale**: Spec Clarifications: assign only; roles exist as data. Seed is “supplied outside this feature’s assignment UI” via migration, which constitution XV already requires. Landing demo codes let US4 show a union of content before finance modules exist.

**Alternatives considered**: Python `Enum` of role names (violates FR-005); empty role tables with no seed (US3/US4 cannot be demonstrated); a role-editor UI (out of scope). Rejected.

## Combined permissions and last-admin guard

**Decision**: Combined permissions are the union of Permission.codes for all RoleAssignments of the user. A permission is granted if any assigned role includes it. Assigning a role the person already has is refused (409 `duplicate_assignment`) via unique `(user_id, role_id)`. Revoke that would leave zero users whose combined permissions include `access_administration` is refused (409 `last_admin_required`), even if that person has other roles.

**Rationale**: FR-006, FR-010, FR-021. Counting people by combined permission (not by a single role name) matches “the last remaining access-administration grant.”

**Alternatives considered**: One role per person (rejected by spec); last-admin check only when revoking a role named Entity Admin (wrong if another seeded or later role also has the permission). Rejected.

## Status is no longer public

**Decision**: `GET /v1/status` keeps the foundation `StatusResponse` body but requires a valid access JWT and at least one role. Unsigned → 401. Signed-in with no roles → 403. The working-and-connected confirmation is shown on or beside the combined landing only (FR-015).

**Rationale**: The spec supersedes the foundation assumption that the confirmation page may be opened without signing in. Keeping the same body avoids inventing a second health schema.

**Alternatives considered**: Leave status public (violates FR-015); delete status (loses SC working-and-connected); allow pending-access users to see status (spec grants it only to people with at least one recognized role). Rejected.

## CORS and transport

**Decision**: CORS `allow_methods` become GET, POST, DELETE. Tokens travel in JSON bodies and the Authorization header, not cookies. `allow_credentials` stays false. `CORS_ORIGINS` remains the allow-list.

**Rationale**: Bearer + localStorage does not need credentialed cookies. Constitution XIV: frontend talks only to the published API.

**Alternatives considered**: Cookie sessions with `allow_credentials=true` (conflicts with localStorage JWT). Rejected.

## Sensitive fields on the landing

**Decision**: `GET /v1/me` returns `landing.sensitiveFinancialFields` (demo `cost` and `margin`) only when `view_sensitive_financial_fields` is in the combined set. Otherwise the property is omitted. The frontend MUST NOT invent those numbers. Landing `sections` include only sections whose permission code is in the combined set.

**Rationale**: Constitution XI: if a number left the server, access control already failed. FR-013, FR-014.

**Alternatives considered**: Always send fields and hide in CSS (violates XI); hardcode Finance User name checks (violates FR-005). Rejected.

## Libraries

**Decision**: Backend adds `PyJWT[crypto]` (or `PyJWT` + `cryptography`) to verify Microsoft JWTs via PyJWKClient and to sign access tokens. Frontend adds `@azure/msal-browser` only (no MSAL React extra tree, no UI kit).

**Rationale**: Smallest libraries that implement JWKS validation and the Microsoft prompt (constitution VI, XVI).

**Alternatives considered**: `python-jose` (less maintained JWKS story); `@azure/msal-react` (extra wrapper); rolling a Microsoft OIDC client (unnecessary). Rejected.

## Testing

**Decision**: Contract tests against this feature’s YAML for auth, me, status-auth, people, and roles. Unit tests for JWT issue/verify, refresh rotation/reuse, last-admin, duplicate assignment, initial-admin bootstrap, and omission of sensitive fields. Frontend tests for localStorage sign-in/out, pending vs landing routing, and refresh-on-401. Integration tests mock Microsoft JWKS rather than calling live Entra in CI; quickstart uses a real tenant for supervised walkthrough (SC-001).

**Rationale**: Constitution III and IV. Live Entra in every CI job is brittle; mocked JWKS still proves validation rules. Supervised walkthrough remains the success-criteria path.

**Alternatives considered**: Only live Entra in CI (secrets and flakiness); skipping refresh-reuse tests. Rejected.

## Environment keys

**Decision**: Document in `.env.example` (placeholders only; implement later):

- Backend: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `INITIAL_ADMIN_EMAIL`, `JWT_SIGNING_KEY`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`
- Frontend (public SPA values, not secrets): `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID`
- Existing: `DATABASE_URL`, `CORS_ORIGINS`, `VITE_API_BASE_URL`, S3 keys

**Rationale**: FR-018, constitution XII. SPA client id and tenant id are not secrets but still MUST NOT bake a production tenant into source as the only value; env keeps local/prod distinct.

**Alternatives considered**: Committed real tenant and admin email for convenience (violates FR-018). Rejected.

## Contract versioning

**Decision**: This feature’s OpenAPI is version **2.0.0**. Breaking change: `GET /v1/status` requires authentication. Frontend `generate:api` and `backend/contracts/` switch to `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` at implementation. Foundation YAML remains historical.

**Rationale**: Constitution II. One SSOT per current API. Keeping 001 as the live contract would leave status public.

**Alternatives considered**: Additive 001 file (cannot express the auth break cleanly); FastAPI auto-schema as SSOT (forbidden). Rejected.
