# Data Model: Settings User Management

Persisted records live in PostgreSQL and change only through Alembic (revision `0003_user_management` after `0002_auth_rbac`). The on-the-wire shapes in [contracts/openapi.yaml](./contracts/openapi.yaml) are the single source of truth for API payloads; this file does not define a second JSON schema.

Landing demo `cost` / `margin` values remain **derived**. They MUST NOT be stored as money columns (constitution XV).

002 entities (`User`, `Permission`, `Role`, `RolePermission`, `RoleAssignment`, `RefreshToken`) stay. This feature adds Invite, InviteRole, `User.entry_path`, and `Permission.module` / `Permission.action`.

## Entities

### User (extended)

A person identified by an organizational Microsoft account. Created on first successful `POST /v1/auth/microsoft` for an accepted tenant. Personal or unknown-directory tokens MUST NOT create a row.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key; used as access JWT `sub` |
| microsoft_oid | string | Unique; Microsoft `oid` claim; still required |
| tenant_id | string | Must equal configured `MICROSOFT_TENANT_ID` |
| display_name | string | From ID token `name` (or equivalent) |
| upn | string | Work email / UPN; invite match and Person.email |
| entry_path | string nullable | `invite` or `organization`; set on first successful sign-in path in this feature |
| created_at | timestamptz | Set on insert |
| updated_at | timestamptz | Set on upsert of profile fields |

**Validation**

- `microsoft_oid` unique. Same person signing in again updates `display_name` / `upn` and does not create a second User.
- Invite consume (see Invite) runs before initial-admin bootstrap.
- Initial-admin bootstrap: if combined permissions do not include `access_administration`, trim `INITIAL_ADMIN_EMAIL` and compare case-insensitively to `preferred_username` and `email`. On match, assign the seeded role that has `access_administration`. Do not skip solely because other roles already exist from an invite.

### Invite

Optional pre-provision record for an organizational work email that has not signed in yet (or whose previous invite was cancelled). Not a Microsoft identity.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key; Person.id when `personType=invite` |
| email | string | Organizational work email as entered |
| invited_by_user_id | UUID | FK User; the access-administration actor |
| created_at | timestamptz | Set on insert |
| consumed_at | timestamptz nullable | Set when a matching Microsoft sign-in copies roles to a User |
| cancelled_at | timestamptz nullable | Set when an unused invite is cancelled |

**Validation**

- Active invite: `consumed_at` IS NULL AND `cancelled_at` IS NULL.
- Unique among **active** invites on `lower(trim(email))`.
- Inviting an email that matches an active invite → 409 `duplicate_invite`.
- Inviting an email that matches a listed User.upn (case-insensitive) → 409 `already_present`.
- Cancel sets `cancelled_at`; the row is no longer listed. Later organization-based sign-in is allowed. The same email may be invited again.
- Consume sets `consumed_at`; InviteRoles are copied then the invite is no longer listed.

### InviteRole

Link between an active Invite and a Role. Same add-don’t-duplicate rule as RoleAssignment.

| Field | Type | Rules |
|-------|------|--------|
| invite_id | UUID | FK Invite |
| role_id | UUID | FK Role |

Unique `(invite_id, role_id)`. Duplicate attach → 409 `duplicate_assignment`.

### Permission (extended)

Named capability stored as data. This feature does **not** create, rename, or delete permission types. Rows are **module-level** now; later modules add more specific codes on the same table.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| code | string | Unique stable key used in authorization checks; keep 002 values |
| name | string | Display label |
| module | string | Required; not a closed enum (`settings`, `finance`, `hr`, `pmo`) |
| action | string nullable | **Null means whole-module.** Future rows set e.g. `create`, `view` |
| description | string nullable | Optional catalog explanation; max 512; not used for authorization |

**Validation**

- Authorization MUST check exact `code` values in the combined set. A module-level grant MUST NOT imply future child codes (no prefix inheritance).
- `module` is catalog metadata for Settings → Permissions grouping, not an authorization key.
- No permission-type editor (FR-014).

**Seed mapping** (002 codes unchanged):

| code | module | action | description |
|------|--------|--------|-------------|
| `access_administration` | `settings` | null | Open Settings and manage people, roles, and assignments. |
| `finance_landing` | `finance` | null | Open the finance landing. |
| `hr_landing` | `hr` | null | Open the HR landing. |
| `pmo_landing` | `pmo` | null | Open the PMO landing. |
| `view_sensitive_financial_fields` | `finance` | `view_sensitive_financial_fields` | View cost, margin, and other sensitive financial fields. |

Alembic `0003_user_management` adds `module` (NOT NULL) and `action` (nullable) on existing `permissions` and backfills the table above. Alembic `0004_permission_description` adds nullable `description` and backfills the seed copy. No new permission table.

### Role (now editable)

Named grouping of permissions. Display name is a label; access follows attached permissions.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | Primary key |
| name | string | Unique; required on create |
| description | string | Optional; max 512 |

**Validation**

- Create with duplicate name → 409 `duplicate_role_name`.
- Attach permission the role already has → 409 `duplicate_permission`.
- Detach leaves remaining RolePermission rows.
- Delete refused while any RoleAssignment **or** InviteRole on an **active** Invite exists (`role_still_assigned`).
- Delete/detach refused when last-admin would fail (`last_admin_required`).

### RolePermission (unchanged unique pair)

### RoleAssignment (unchanged unique pair)

Assign adds; does not replace. Duplicate → 409 `duplicate_assignment`. Revoke that would leave zero signed-in Users with `access_administration` → 409 `last_admin_required`.

### RefreshToken (unchanged)

### Person (API, not a table)

Union of User and active Invite for `GET /people`.

| Field | Type | Rules |
|-------|------|--------|
| id | UUID | User.id or Invite.id |
| personType | enum | `user` \| `invite` |
| email | string | User.upn or Invite.email |
| displayName | string | Present for users after sign-in; omitted for unused invites |
| status | enum | `invited` \| `pending` \| `active` |
| entryPath | enum | `invite` \| `organization`; users only |
| roles | RoleSummary[] | RoleAssignment or InviteRole |

**Status**

- `invited` — active Invite
- `pending` — User with zero RoleAssignments
- `active` — User with one or more RoleAssignments

### Pending Access / Authorized Landing (runtime, unchanged)

Pending: session and zero RoleAssignments. Authorized: one or more RoleAssignments. Combined landing lists every assigned role name and only combined-permission content.

## Combined permissions

```text
combined(user) = UNION permission.code
  FOR EACH RoleAssignment of user
  JOIN RolePermission, Permission
```

A permission is granted if its **exact code** appears in that set. Authorization MUST use this set, never role display names, `module` strings, or prefix matching. A module-level row (null `action`) does not grant later child codes on the same module.

Last-admin:

```text
admins = Users with access_administration in combined(user)
Refuse change if |admins after change| = 0
Unused Invites are not in admins
```

## State transitions

```text
invite created                  → listed invited; cannot use the app
invite + Microsoft email match  → User; roles copied; invite consumed; entry_path=invite
org sign-in, no invite          → User pending; entry_path=organization; listed waiting for a role
cancel unused invite            → gone from list; later org sign-in allowed
remove signed-in User           → User and assignments gone; refresh family revoked;
                                  later org sign-in → new User pending
assign/revoke on User           → next request uses new combined set
assign/revoke on Invite         → listed roles change; still cannot use the app until sign-in
role create/edit/attach/detach  → every assignee’s next request follows new combined set
delete role                     → refused if assigned to User or active Invite
```

```text
no session          → 401 on protected routes
session, 0 roles    → pending access; GET /me accessState=pending; Settings 403
session, ≥1 roles   → combined landing; Settings only if access_administration
```

## Persistence

- **PostgreSQL**: Alembic `0003_user_management` creates `invites` and `invite_roles`, adds nullable `users.entry_path`, adds `permissions.module` (NOT NULL, backfilled) and `permissions.action` (nullable, backfilled), unique index on `lower(trim(email))` for active invites. No auto-rewrite on startup.
- **S3**: Unchanged.
- **Money**: No stored money columns.

## Relationships

```text
User 1--* RoleAssignment *--1 Role
Role 1--* RolePermission *--1 Permission
User 1--* RefreshToken
User (invited_by) 0--* Invite
Invite 1--* InviteRole *--1 Role
Invite (consume) --copies InviteRole--> RoleAssignment on User
Frontend Session --stores--> access JWT + refresh token (localStorage)
```

## Mapping to spec entities

| Spec entity | This model |
|-------------|------------|
| User | User |
| Invite | Invite + InviteRole |
| Role | Role + RolePermission |
| Permission | Permission (`code`, `module`, nullable `action`; read-only APIs) |
| Role Assignment | RoleAssignment (users) and InviteRole (unused invites) |
| Settings | Frontend IA; not a table |
| Pending Access | GET /me `landing.accessState=pending` |
| Authorized Landing | GET /me when roles exist |
