# Quickstart: Contracts Module

## Prerequisites

- Backend and frontend as for feature 004
- Migrated DB through `0006_contracts_module`
- S3 endpoint reachable (or mocked in tests)

## Backend

```bash
cd backend
alembic upgrade head
# OPENAPI_PATH should resolve to specs/005-contracts-module/contracts/openapi.yaml
# (or backend/contracts/openapi.yaml copy)
uvicorn app.main:app --reload --port 8000
```

## Frontend

```bash
cd frontend
npm run generate:api
npm run dev
```

## Smoke checks

1. Sign in as a user with `manage_contracts`.
2. Confirm Entity Switcher shows Entity A / B / C / All Entities.
3. Select Entity A → Contracts → create via wizard with INR or USD.
4. Select All Entities → list shows consolidated rows; New Contract disabled.
5. Sign in without `view_contract_financials` → money fields hidden.
