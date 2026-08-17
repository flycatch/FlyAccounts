# Quickstart: Settings Routes and MANAGE_* RBAC

## Prerequisites

Same as 003, plus:

- `INITIAL_ADMIN_EMAIL` set to the first admin’s organizational work email
- Frontend depends on `react-router-dom`

## Migrate

```bash
cd backend && alembic upgrade head
```

Applies through `0005_manage_permissions_seed` (System Admin + manage_* only).

## Contract

```bash
cp specs/004-settings-routes-rbac/contracts/openapi.yaml backend/contracts/openapi.yaml
cd frontend && npm run generate:api
```

## Verify

1. Sign in as `INITIAL_ADMIN_EMAIL` → System Admin → open `/settings/users`, `/settings/roles`, `/settings/permissions`.
2. Select a person → multi-select roles → assign (no global Assign Roles button).
3. Permissions page shows module groups with name, permission, description.
4. Invite creates a DB invite only (no email).

## Notes

- Outbound invite email is out of scope.
- Combined landing sections from finance/hr/pmo are empty until later modules reintroduce codes.
