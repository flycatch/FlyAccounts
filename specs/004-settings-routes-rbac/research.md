# Research: Settings Routes and MANAGE_* RBAC

## Routing

**Decision**: Add `react-router-dom` with `/`, `/settings/users`, `/settings/roles`, `/settings/permissions`. Replace App `view` state.

**Rationale**: Spec requires shareable URLs and deep links; state-only navigation cannot.

## Permission codes

**Decision**: `manage_users`, `manage_roles`, `manage_permissions` only. Replace `access_administration` for gates and last-admin (`manage_users`).

**Rationale**: User locked MANAGE_* for both nav and APIs; demo landing codes removed from seed.

## Permissions response

**Decision**: `{ modules: [{ module, permissions: [{ id, name, permission, description? }] }] }`.

**Rationale**: UI groups by module; card fields are name / permission / description only.

## Assign roles

**Decision**: `AssignRoleRequest.roleIds` (min 1). Path identifies the person/invite. Remove global Assign Roles UI.

**Rationale**: User-specific multi-select from detail.

## Invite email

**Decision**: Deferred; no mail service in this feature.

## Initial admin

**Decision**: Bootstrap assigns first role that grants `manage_users` (System Admin) when `INITIAL_ADMIN_EMAIL` matches.
