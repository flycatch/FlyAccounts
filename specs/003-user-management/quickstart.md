# Quickstart: Settings User Management

Everyday start instructions also live in the root [README.md](../../README.md). This file is the validation walkthrough.

Validate dual entry (invite and organization-based sign-in), Settings → Users / Roles / Permissions, combined permissions, last-admin, cancel/remove, and the standing field policy. Implementation code belongs in a later phase; this guide is the runnable check against [spec.md](./spec.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), and [ui-spec.md](./ui-spec.md).

## Prerequisites

- Docker and Docker Compose
- A copy of this repository
- An Entra ID app registration (SPA, single tenant) whose redirect URI matches the frontend origin (default `http://localhost:8080`)
- The organizational Microsoft work email of the person who should receive the first access-administration assignment (`INITIAL_ADMIN_EMAIL`)
- At least three organizational work or school accounts in that tenant (initial admin, a second person to invite, a third uninvited org account). Personal Microsoft accounts must be rejected.

## Setup

1. Copy the shared env template (do not commit the copy):

   ```bash
   cp deployment/.env.example deployment/.env
   ```

2. Set placeholders in `deployment/.env` (never commit real values):

   - `MICROSOFT_TENANT_ID` / `VITE_MICROSOFT_TENANT_ID`
   - `MICROSOFT_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID`
   - `INITIAL_ADMIN_EMAIL`
   - `JWT_SIGNING_KEY`
   - `JWT_ACCESS_TTL_SECONDS` — default `900`
   - `JWT_REFRESH_TTL_SECONDS` — default `604800`

3. Start frontend, backend, PostgreSQL, and MinIO:

   ```bash
   docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build
   ```

   Alembic applies through `0003_user_management` (invites, invite roles, `users.entry_path`). Seeded roles and permission codes: [data-model.md](./data-model.md).

4. Open the frontend URL (see `FRONTEND_PORT` / `deployment/.env.example`).

## Validation scenarios

### 1. Settings from the sidebar (US1, SC-001, FR-001, FR-021)

Sign in as `INITIAL_ADMIN_EMAIL`.

- Combined landing is the home. Sidebar shows Home and a **Settings** group with **Users**, **Roles**, and **Permissions** ([ui-spec.md](./ui-spec.md)).
- Standalone “Access administration” is gone.
- Open Users, Roles, and Permissions. Invite a person from Users within 3 minutes of starting the task (SC-001).
- A person without `access_administration` does not see Settings and cannot open those screens (FR-002). APIs return 403.

### 2. Invite with and without roles (US2, FR-004, FR-005)

From Settings → Users ([POST /people/invites](./contracts/openapi.yaml)):

- Invite one organizational email with two existing roles; invite another with no roles. Both appear as `invited`.
- Duplicate invite of the same email is refused (`duplicate_invite`).
- Invite of an email that already belongs to a listed User is refused (`already_present`).
- Neither invited person can use the application until they sign in.

### 3. Organization-based entry (US4, SC-003, FR-006)

Sign in with a valid organizational Microsoft account that was never invited.

- Sign-in succeeds. With no roles they see pending access only.
- They appear in Settings → Users as `pending` / waiting for a role.
- A personal Microsoft account is still refused.

### 4. Sign-in follows combined permissions (US3, SC-002, SC-004, FR-007)

- Invited person with roles signs in with the matching work email: invite is consumed; combined landing lists every assigned role name and only the union of permissions.
- Invited person with no roles signs in: pending access only.
- Assign two different roles to an organization-entered person: same union behavior.
- Compare a two-role person with a one-role person: the second does not see content outside their single role.

### 5. Assign and revoke (US5, FR-008–FR-010)

From Users, assign and revoke on both a signed-in User and an unused Invite ([POST/DELETE /people/{userId}/roles](./contracts/openapi.yaml), [POST/DELETE /people/invites/{inviteId}/roles](./contracts/openapi.yaml)).

- Assign adds; it does not replace.
- Duplicate assign is refused (`duplicate_assignment`).
- Revoke one of several: remaining stay. Revoke the last: person stays listed as `pending`.
- Revoke that would leave zero signed-in people with `access_administration` is refused (`last_admin_required`). Unused invites do not count as admins.

### 6. Create and edit roles (US6, SC-008, FR-011–FR-014)

From Settings → Roles:

- Create a role with a name and optional description; attach at least two existing permissions ([GET /permissions](./contracts/openapi.yaml) is a read-only catalog grouped by module).
- Assign it to a person; detach one permission; their next use follows the remaining set (SC-007).
- Duplicate role name is refused (`duplicate_role_name`).
- No control exists to create a new permission type (FR-014, SC-008).

### 7. Delete a role (US7, FR-013)

- Delete while anyone (User or active Invite) is assigned: refused (`role_still_assigned`).
- Revoke assignments, then delete: succeeds.
- Delete that would remove the last access-administration path: refused (`last_admin_required`).

### 8. Cancel invite and remove person (US8, SC-009, FR-018)

- Cancel an unused invite: gone from Users. That organizational account may still sign in, see pending access, and appear as waiting for a role. The email may be invited again.
- Remove a signed-in person who is not the last admin: gone from the list, no roles. Later org sign-in → pending again.
- Remove that would leave zero admins: refused (`last_admin_required`).

### 9. Sensitive fields (SC-005, FR-016)

Testers observe cost and margin on the combined landing if and only if `view_sensitive_financial_fields` is in the combined set (including when it comes from only one of several roles). Otherwise those fields are absent from `GET /me`.

### 10. Readable on phone, tablet, and desktop (SC-010, FR-020)

Resize the browser. Open Settings → Users, invite, assign a role, and create a role without horizontal cramming. Keyboard works for the same tasks. Sidebar collapses on small widths ([ui-spec.md](./ui-spec.md)).

### 11. No dummy path or committed secrets (SC-011, FR-022)

- No local username/password or bypass sign-in.
- `deployment/.env` is not committed. `INITIAL_ADMIN_EMAIL` and secrets in source are placeholders only.
- Testers without `access_administration` cannot complete invite, assignment, or role change.

## Notes

- Secrets and the designated initial Microsoft identity stay in `deployment/.env`, never in source.
- [contracts/openapi.yaml](./contracts/openapi.yaml) is the single source of truth (v3.0.0).
- Do not add Compose or `.env` files under `frontend/` or `backend/`.
- Permission types are seeded data from 002; this feature only attaches them to roles.
- Invite does not send email; it is an in-app record keyed by work email.
