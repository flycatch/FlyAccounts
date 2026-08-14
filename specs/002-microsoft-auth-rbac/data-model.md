# Data Model: Microsoft Authentication with RBAC

Persisted records live in PostgreSQL and change only through Alembic (revision after `0001_baseline`). The on-the-wire shapes in [contracts/openapi.yaml](./contracts/openapi.yaml) are the single source of truth for API payloads; this file does not define a second JSON schema.

Landing demo `cost` / `margin` values are **derived** for the standing field policy. They are not posted financial documents and MUST NOT be stored as money columns in this feature (constitution XV).

## Entities

### User

A person identified by an organizational Microsoft account. Created on first successful `POST /v1/auth/microsoft` for an accepted tenant. Personal or unknown-directory tokens MUST NOT create a row.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key; used as access JWT `sub` |
| microsoft_oid | string | Unique; Microsoft `oid` claim |
| tenant_id | string | Must equal configured `MICROSOFT_TENANT_ID` |
| display_name | string | From ID token `name` (or equivalent) |
| upn | string | From ID token `preferred_username` / UPN; used with `email` (if present) for the initial-admin match |
| created_at | timestamptz | Set on insert |
| updated_at | timestamptz | Set on upsert of profile fields |

**Validation**

- `microsoft_oid` unique. Same person signing in again updates `display_name` / `upn` and does not create a second User.
- Initial-admin bootstrap: if the user has no RoleAssignment yet, trim `INITIAL_ADMIN_EMAIL` and compare it case-insensitively to the ID token `preferred_username` and, if present, the `email` claim. On match, assign the seeded role that has `access_administration`. Do not re-assign on later sign-ins if an administrator already changed their roles. `microsoft_oid` remains the unique stored identity; it is not the bootstrap match.

### Permission

A named capability stored as data. This feature does not create or edit permissions at runtime.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| code | string | Unique stable code used in authorization checks |
| name | string | Display label |

**Seeded codes** (migration data, not a closed enum in application logic):

- `access_administration`
- `view_sensitive_financial_fields`
- `finance_landing`
- `hr_landing`
- `pmo_landing`

### Role

A named grouping of permissions. Exists as data. This feature does not create, rename, or edit roles at runtime.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| name | string | Unique display name |
| description | string | Optional |

**Seeded rows** (names are data): Entity Admin, Finance User, HR User, PMO User. See [research.md](./research.md) for the seeded RolePermission map.

### RolePermission

Link between Role and Permission.

| Field | Type | Rules |
|-------|------|--------|
| role_id | UUID | FK Role |
| permission_id | UUID | FK Permission |

Unique `(role_id, permission_id)`.

### RoleAssignment

Link between User and Role. Created or revoked by a caller whose combined permissions include `access_administration`, except the configured initial assignment.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| user_id | UUID | FK User |
| role_id | UUID | FK Role |
| assigned_by_user_id | UUID nullable | FK User; null for initial-admin bootstrap |
| created_at | timestamptz | Set on insert |

**Validation**

- Unique `(user_id, role_id)` — assigning the same role twice is refused (`duplicate_assignment`).
- Assign adds; it does not replace other assignments.
- Revoke deletes one row. Remaining assignments stay.
- Refuse revoke when the change would leave zero Users whose **combined** permissions include `access_administration` (`last_admin_required`).

### RefreshToken

Server-side record of an opaque refresh token. The raw token is shown to the client once; only the hash is stored.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| user_id | UUID | FK User |
| token_hash | string | Unique SHA-256 hex of the raw token |
| family_id | UUID | Shared across rotations of one sign-in chain |
| expires_at | timestamptz | From `JWT_REFRESH_TTL_SECONDS` |
| revoked_at | timestamptz nullable | Set on rotation, logout, or family revoke |
| replaced_by_id | UUID nullable | FK RefreshToken; set on successful rotation |
| created_at | timestamptz | Set on insert |

**Validation**

- Redeem only if `revoked_at` is null and `expires_at` is in the future.
- Successful redeem: insert a new row in the same `family_id`, set old `revoked_at` and `replaced_by_id`.
- Redeem of a rotated or revoked hash: set `revoked_at` on every row with that `family_id`; return 401; issue nothing.
- Logout: revoke the presented token (and the rest of its family).

### Session (runtime)

The signed-in period in the browser. Not a table.

| Field | Type | Rules |
|-------|------|--------|
| accessToken | JWT | `localStorage` key `flyaccounts.accessToken`; Bearer header |
| refreshToken | opaque string | `localStorage` key `flyaccounts.refreshToken` |
| expiresIn | int | Seconds; from token response |

Access JWT claims: `sub` (User.id), `iat`, `exp`. MUST NOT include roles or permissions.

**Transitions**

```text
unsigned → signed_pending     # Microsoft OK, no RoleAssignment
unsigned → signed_authorized  # Microsoft OK, one or more roles (including initial admin)
signed_pending → signed_authorized  # assignment added; next request
signed_authorized → signed_pending  # last role revoked; next request
signed_* → unsigned           # logout or refresh failure / family revoke
access_expired → signed_*     # successful POST /auth/refresh
access_expired → unsigned     # refresh 401
```

### Pending Access (runtime)

Shown when a Session exists and the User has zero RoleAssignments. No combined landing, no access administration, no `GET /v1/status`.

### Authorized Landing (runtime)

Shown when a Session exists and the User has one or more RoleAssignments. Lists every assigned role name. `sections` and `sensitiveFinancialFields` follow the **union** of Permission.codes. `sensitiveFinancialFields` is omitted when `view_sensitive_financial_fields` is absent.

## Combined permissions

```text
combined(user) = UNION permission.code
  FOR EACH RoleAssignment of user
  JOIN RolePermission, Permission
```

A permission is granted if it appears in that set. Authorization MUST use this set, never role display names.

## State transitions (authorization)

```text
no session          → 401 on protected routes; sign-in path in the UI
session, 0 roles    → pending access; GET /me accessState=pending; GET /status 403
session, ≥1 roles   → combined landing; GET /me accessState=authorized; GET /status 200
last role revoked   → pending on next request
admin grant added   → landing / admin UI on next request
```

## Persistence

- **PostgreSQL**: Alembic revision `0002_auth_rbac` creates the tables above and seeds Permission, Role, and RolePermission rows. No auto-rewrite on startup.
- **S3**: Unchanged; not used for identity.
- **Money**: No stored money columns. Demo cost/margin on `GET /me` are derived literals for field-policy tests only.

## Relationships

```text
User 1--* RoleAssignment *--1 Role
Role 1--* RolePermission *--1 Permission
User 1--* RefreshToken
User (assigned_by) 0--* RoleAssignment
RefreshToken (family_id) groups rotations
Frontend Session --stores--> access JWT + refresh token (localStorage)
Access JWT sub --identifies--> User.id
Protected request --loads--> combined(user) from RoleAssignment
```

## Mapping to spec entities

| Spec entity | This model |
|-------------|------------|
| User | User |
| Role | Role + RolePermission |
| Permission | Permission |
| Role Assignment | RoleAssignment |
| Session | Session + RefreshToken |
| Authorized Landing | GET /me `landing` when roles exist |
| Pending Access | GET /me `landing.accessState=pending` |
