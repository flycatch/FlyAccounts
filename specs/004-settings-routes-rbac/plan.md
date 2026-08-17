# Implementation Plan: Settings Routes and MANAGE_* RBAC

**Branch**: `004-settings-routes-rbac` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

## Summary

Breaking change from 003: Settings uses URL routes and `manage_users` / `manage_roles` / `manage_permissions`. Seeds are System Admin plus those three permissions only. Permissions API returns module groups. Role assignment uses `roleIds[]` from the selected person. Invite email remains deferred. Contract: [contracts/openapi.yaml](./contracts/openapi.yaml) v4.0.0.

## Technical Context

**Language/Version**: Python 3.12, TypeScript + React 18  
**Primary Dependencies**: FastAPI, react-router-dom, existing MSAL + openapi-fetch stack  
**Storage**: PostgreSQL; Alembic `0005_manage_permissions_seed` after `0004_permission_description`  
**Testing**: pytest contract/unit; Vitest with MemoryRouter  
**Constraints**: No mail; secrets via env; OpenAPI SSOT v4.0.0

## Constitution Check

PASS — single backend/frontend, contract-first v4, test updates, no permission-type editor, no new secrets beyond existing `INITIAL_ADMIN_EMAIL`.

## Project Structure

```text
specs/004-settings-routes-rbac/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, ui-spec.md
└── contracts/openapi.yaml
backend/alembic/versions/0005_manage_permissions_seed.py
frontend/src/App.tsx  # BrowserRouter routes
```

## Contract consumption

Copy OpenAPI to `backend/contracts/openapi.yaml`. Point frontend `generate:api` at this feature’s YAML.
