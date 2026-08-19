# Implementation Plan: Contracts Module (list + wizard)

**Branch**: `005-contracts-module` | **Date**: 2026-08-17 | **Spec**: [spec.md](./spec.md)

## Summary

Add seeded legal entities, Entity Switcher + Contracts list, and a 4-step create wizard. OpenAPI **5.0.0** extends 4.0.0. View/Edit/Delete remain stubs.

## Technical Context

- **Language/Version**: Python 3.12 (backend), TypeScript + React 18 (frontend)
- **Primary Dependencies**: FastAPI, SQLAlchemy, Alembic, openapi-fetch, react-router-dom
- **Storage**: PostgreSQL + S3-compatible object storage for contract files
- **Testing**: pytest (backend), vitest + Testing Library (frontend)
- **Target Platform**: Linux containers / local Vite + uvicorn
- **Project Type**: Web application (API + SPA)
- **Performance Goals**: List under typical demo data sizes without pagination in MVP
- **Constraints**: Money as decimal strings; no Entity field on forms; consolidated All read-only for create
- **Scale/Scope**: Three seeded entities; create + list only

## Constitution Check

- Contract-first OpenAPI SSOT: yes (v5.0.0)
- Entity context via switcher / header, not form field: yes
- Money as strings + HR redaction via `view_contract_financials`: yes
- Tests for entity scope and money redaction: yes

## Project Structure

### Documentation

```text
specs/005-contracts-module/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/openapi.yaml
```

### Source

```text
backend/
├── alembic/versions/0006_contracts_module.py
├── app/models/entity.py
├── app/models/contract.py
├── app/api/entities.py
├── app/api/contracts.py
├── app/storage/s3.py          # upload helper
└── contracts/openapi.yaml     # copy of SSOT

frontend/
├── src/entity/EntityContext.tsx
├── src/pages/contracts/ContractsPage.tsx
├── src/pages/contracts/NewContractWizard.tsx
└── src/layout/*               # switcher + Contracts nav
```

## Implementation phases

1. Spec + OpenAPI v5 + copy to `backend/contracts` + retarget `generate:api` / FEATURE_OPENAPI / main fallback
2. Alembic `0006_contracts_module` tables + seeds
3. Entities + contracts APIs with `X-Entity-Id` and redaction
4. Entity context + list UI
5. Wizard UI
6. Backend + frontend tests

## Complexity Tracking

None beyond constitution requirements.
