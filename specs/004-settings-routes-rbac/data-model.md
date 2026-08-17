# Data Model: Settings Routes and MANAGE_* RBAC

Persisted entities from 003 remain. This feature changes **seed data** and **wire shapes**.

## Permission (seed)

| Field | Rules |
|-------|--------|
| code | Stable auth key; seeded values `manage_users`, `manage_roles`, `manage_permissions` (DB column remains `code`; API catalog field is `permission`) |
| name | Display label |
| module | `settings` for all three |
| action | Unused for these seeds (nullable) |
| description | Catalog text |

### Seed mapping

| permission (code) | name | module | description |
|-------------------|------|--------|-------------|
| `manage_users` | Manage users | settings | Open Settings → Users and manage people, invites, and role assignments. |
| `manage_roles` | Manage roles | settings | Open Settings → Roles and create, edit, or delete roles and attach permissions. |
| `manage_permissions` | Manage permissions | settings | Open Settings → Permissions and view the permission catalog. |

Remove seeded Finance/HR/PMO/Entity Admin roles and prior permission codes via Alembic `0005_manage_permissions_seed`.

## Role (seed)

| name | permissions |
|------|-------------|
| System Admin | all three MANAGE_* |

## Last-admin

Counts signed-in Users whose combined permissions include `manage_users`.

## API shapes (see OpenAPI)

- `PermissionsResponse.modules[]`
- `Permission`: `id`, `name`, `permission`, optional `description`
- `AssignRoleRequest.roleIds[]`
