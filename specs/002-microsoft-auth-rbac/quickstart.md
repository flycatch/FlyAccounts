# Quickstart: Microsoft Authentication with RBAC

Everyday start instructions also live in the root [README.md](../../README.md). This file is the validation walkthrough.

Validate Microsoft sign-in, pending access, role assignment, the combined landing, refresh, and sign-out. Implementation code belongs in a later phase; this guide is the runnable check against [spec.md](./spec.md), [data-model.md](./data-model.md), and [contracts/openapi.yaml](./contracts/openapi.yaml).

## Prerequisites

- Docker and Docker Compose
- A copy of this repository
- An Entra ID app registration (SPA, single tenant) whose redirect URI matches the frontend origin (default `http://localhost:8080`)
- The organizational Microsoft work email of the person who should receive the first access-administration assignment
- At least two organizational work or school accounts in that tenant (initial admin + a second person). Personal Microsoft accounts must be rejected.

## Setup

1. Copy the shared env template (do not commit the copy):

   ```bash
   cp deployment/.env.example deployment/.env
   ```

2. Set placeholders in `deployment/.env` (never commit real values):

   - `MICROSOFT_TENANT_ID` / `VITE_MICROSOFT_TENANT_ID` — same tenant
   - `MICROSOFT_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID` — same SPA client id
   - `INITIAL_ADMIN_EMAIL` — organizational Microsoft work email of the first administrator
   - `JWT_SIGNING_KEY` — long random string used to sign access JWTs
   - `JWT_ACCESS_TTL_SECONDS` — default `900`
   - `JWT_REFRESH_TTL_SECONDS` — default `604800`

3. Start frontend, backend, PostgreSQL, and MinIO:

   ```bash
   docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build
   ```

   Alembic applies `0002_auth_rbac` (users, roles, permissions, refresh tokens, and seed roles). Seeded role names and permission codes are listed in [data-model.md](./data-model.md).

4. Open the frontend URL (see `FRONTEND_PORT` / `deployment/.env.example`).

## Validation scenarios

### 1. Unsigned visit requires Microsoft sign-in (US1, SC-002, FR-001)

- Opening the app unsigned shows the Microsoft sign-in path.
- Combined landing, pending access, access administration, and the working-and-connected confirmation are not shown as a public home.
- Cancel or fail Microsoft sign-in: the person stays unsigned (FR-003).
- A personal Microsoft account is not granted access and is not treated as pending (FR-002).

### 2. Initial admin bootstrap (US1, US3, FR-011)

Sign in with the organizational account whose work email matches `INITIAL_ADMIN_EMAIL` (case-insensitive).

- The person is signed in without another person assigning a role.
- Combined landing lists the seeded role that includes `access_administration`.
- Access administration is reachable.
- `localStorage` contains `flyaccounts.accessToken` and `flyaccounts.refreshToken`.

Sign in with a different organizational account that has never been assigned a role:

- Pending-access message only (US2, SC-003).
- Combined landing, access administration, and `GET /v1/status` are refused.

### 3. Assign and revoke roles (US3, SC-004, SC-007)

As the initial admin, open access administration (people who have already signed in; [GET /people](./contracts/openapi.yaml) and [GET /roles](./contracts/openapi.yaml)).

- Assign two different existing roles to the second person. Their next visit shows one combined landing that lists **both** role names (FR-008, FR-012).
- Assign the same role again: refused or no duplicate (`duplicate_assignment`, FR-006).
- Revoke one of two roles: the remaining role stays; landing follows the remaining combined permissions (FR-009, FR-020).
- Revoke the last remaining `access_administration` grant in the organization: refused (`last_admin_required`); at least one person with that permission remains (FR-010, SC-007).
- A person without `access_administration` cannot assign or revoke (403).

### 4. Combined landing and sensitive fields (US4, SC-005, FR-013)

- Landing states the person’s name and every assigned role name.
- Sections appear only for permission codes in the combined set (union).
- `cost` and `margin` appear if and only if `view_sensitive_financial_fields` is in that set (including when it comes from only one of several roles). Otherwise those fields are absent from `GET /me` (see [MeResponse](./contracts/openapi.yaml)).
- Compare a person with two roles against a person with only one of those roles: the second person does not see content outside their single role.
- Working-and-connected confirmation is available on or beside this landing for people with at least one role; unsigned people must not see it (FR-015).

### 5. Authenticated status (FR-015)

While signed in with at least one role and all Compose services running:

- Landing (or adjacent status) reports connected successfully.
- After a successful `GET /v1/status`:

```json
{ "service": "ok", "database": "ok", "storage": "ok" }
```

Unsigned `GET /v1/status` is 401. Pending-access `GET /v1/status` is 403.

Stop the backend and refresh as an authorized person: the UI reports not connected and MUST NOT say connected successfully (same honesty rule as foundation).

### 6. Refresh token (session persistence)

- Refresh the browser while still signed in: pending access or combined landing appears, not the unsigned sign-in path.
- After the access JWT expires (or with a shortened `JWT_ACCESS_TTL_SECONDS` in a throwaway local `.env`), the next API call uses `POST /v1/auth/refresh` and the person stays signed in with a new pair in `localStorage`.
- Replaying an already-rotated refresh token fails and signs the person out of that family.

### 7. Sign out (US5, SC-006, FR-016)

- Sign out: tokens leave `localStorage`; the sign-in path is shown.
- Reopen the app or a previous landing URL: Microsoft sign-in is required again.
- Pending access, combined landing, and access administration are not reachable until sign-in.

### 8. Readable on phone, tablet, and desktop (SC-009, FR-019)

Resize the browser (or use device widths). Sign-in, pending access, combined landing, and (for access-administration) assign a role remain usable with a keyboard, without horizontal cramming.

### 9. No dummy path or committed secrets (SC-008, FR-017, FR-018)

- No local username/password or bypass sign-in.
- `deployment/.env` is not committed. `INITIAL_ADMIN_EMAIL`, `JWT_SIGNING_KEY`, and tenant/client values in source are placeholders only.

## Notes

- Secrets and the designated initial Microsoft identity stay in `deployment/.env`, never in source.
- [contracts/openapi.yaml](./contracts/openapi.yaml) is the single source of truth. Frontend and backend talk only through that document.
- Do not add Compose or `.env` files under `frontend/` or `backend/`.
- Creating or editing roles and permissions is out of scope; use the seeded rows from [data-model.md](./data-model.md).
