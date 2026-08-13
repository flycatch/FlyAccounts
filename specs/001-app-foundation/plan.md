# Implementation Plan: App Foundation

**Branch**: `001-app-foundation` | **Date**: 2026-08-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-app-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

FlyAccounts foundation is one React frontend and one FastAPI backend. Opening the app shows a single confirmation page: the application is working, whether the frontend reached the backend, and (when the backend responded) whether PostgreSQL and S3-compatible storage are reachable. [contracts/openapi.yaml](./contracts/openapi.yaml) is the **single source of truth** for `GET /v1/status`. The backend MUST implement that document; the frontend MUST generate its client/types from that same file and MUST NOT call unofficial endpoints or hand-roll a parallel status shape. Shared Docker Compose and environment files live in a root `deployment/` folder used by frontend, backend, PostgreSQL, and MinIO. No sign-in, entities, invoices, or other finance UI.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript + React 18 (frontend)

**Primary Dependencies**: FastAPI, Uvicorn, SQLAlchemy 2, Alembic, psycopg, boto3, OpenTelemetry FastAPI instrumentation, OpenAPI contract tests against the committed YAML; Vite, React, ordinary CSS (no large UI kit), `openapi-typescript` + `openapi-fetch` (frontend consumes the same YAML)

**Storage**: PostgreSQL 16 (Alembic-managed; this stage has no business tables). S3-compatible object storage (MinIO locally; `HeadBucket` only — no upload API)

**Testing**: pytest + httpx (backend contract tests MUST assert live responses match `contracts/openapi.yaml`); Vitest + Testing Library (frontend uses the generated client); one compose-backed integration path for status

**Target Platform**: Linux local/dev; browsers on phone, tablet, and desktop widths

**Project Type**: Decoupled web app (frontend + backend)

**Performance Goals**: Working and connection messages visible within 10 seconds (SC-001)

**Constraints**: Secrets only via environment (`deployment/.env` gitignored; `deployment/.env.example` committed). Honest failure: never show connected-success if the status request failed. Do not fake database/storage as ok.

**Scale/Scope**: One status page, one versioned endpoint, one shared `deployment/` Compose stack with four services (frontend, backend, PostgreSQL, MinIO)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-design: PASS** (one justified exception; see Complexity Tracking)

| Gate | Result |
|------|--------|
| I. Minimal Structure | Pass — one backend, one frontend. Postgres and MinIO are compose infrastructure, not extra applications. One shared `deployment/` folder; no per-app compose stacks. |
| II. Contract-First OpenAPI | Pass — `contracts/openapi.yaml` is the single source of truth. Backend implements it; frontend generates from it. FastAPI auto-schema is not the contract. |
| III. Test-First | Pass — contract, unit, and integration tests planned before production code. |
| IV. Integration Testing | Pass — frontend and backend checked together against the status contract. |
| V. OpenTelemetry | Pass — basic traces on the status request path. |
| VI. Simplicity | Pass — status page and health checks only; no accounting modules. |
| VII. Basic Security | Exception — auth deferred; secrets still not committed. See Complexity Tracking. |
| VIII. Performance | Pass — one small status fetch; SC-001 within 10 seconds. |
| IX. Accessible, Responsive UI | Pass — readable stacked layout on phone, tablet, and desktop; keyboard-usable. |
| X. Conventional Commits | Pass — later implementation commits use Conventional Commits. |
| XI. Authorized Access | Exception — no user data or roles in this stage. See Complexity Tracking. |
| XII. Operational Readiness | Pass — env-based config and Compose in `deployment/`; root `README.md` for everyday start; full checks in quickstart. |
| XIII. Production Grade | Pass — no dummy auth; honest connected / not connected; do not fake DB or S3 as ok. |
| XIV. Decoupled System | Pass — separate trees; talk only through the published YAML. Each app copies or generates from `specs/001-app-foundation/contracts/openapi.yaml`; they do not share source folders. |
| XV. Clean Data Models | Pass — Alembic from day one; no auto-rewrite; no money fields in this stage. |
| XVI. Maintainable UI | Pass — React with ordinary page controls; no large UI kit. |

Quality gates from constitution:

1. Follows the principles above — **Pass** (auth exception justified).
2. OpenAPI contract before code — **Pass** (`contracts/openapi.yaml` is SSOT; frontend consumes it).
3. Tests for money, entity context, and access rules it touches — **N/A** (this feature touches none).
4. Consolidated view read-only; no Entity field on forms — **N/A** (no forms, no entity context).
5. Secrets out of the repository — **Pass**.
6. OpenTelemetry on new request paths — **Pass**.

**Post-design re-evaluation: PASS** (same justified exception)

Phase 1 artifacts (`research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`) plus a planned root `README.md` do not add extra applications, unofficial endpoints, accounting UI, committed secrets, or a monitoring stack. `contracts/openapi.yaml` is the single source of truth for the working-and-connected check (FR-002, FR-007). The backend implements that document; the frontend generates its client from the same file. Data model is runtime-only plus an Alembic baseline. `deployment/` remains the single Compose/env location. One root README is the project entry point; it is not a second Compose/env location and not a per-app README. Auth stays deferred per Complexity Tracking. Gates 3 and 4 remain N/A. No new constitution violations. Implementation may proceed to `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/001-app-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
README.md

backend/
  Dockerfile
  app/
    main.py
    api/status.py
    core/config.py
    core/telemetry.py
    db/session.py
    storage/s3.py
  alembic/
  tests/
    contract/
    integration/
    unit/

frontend/
  Dockerfile
  src/
    pages/
    api/client.ts          # openapi-fetch client typed from generated schema
    api/schema.d.ts        # generated from contracts/openapi.yaml; do not edit by hand
  tests/

deployment/
  docker-compose.yml
  .env.example
```

**Structure Decision**: Decoupled web application. `backend/` and `frontend/` are separate apps with no shared source folders. `deployment/` is the only place for Compose and environment config. One `docker-compose.yml` defines four services: `frontend`, `backend`, `postgres`, and `minio`. One `.env.example` documents the shared variables those services read. Copy to `deployment/.env` locally; that file stays gitignored. App Dockerfiles stay next to each app and are referenced from Compose with context `../backend` and `../frontend`. One root `README.md` is the project entry point (constitution XII). It is not a second Compose/env location and not a per-app README. Point readers to [quickstart.md](./quickstart.md) for the full connected vs not-connected checks.

**Contract consumption**: [contracts/openapi.yaml](./contracts/openapi.yaml) is the only status API. At implementation, the frontend build generates TypeScript types (and an `openapi-fetch` client) from that file. The backend implements `GET /v1/status` to match it and proves the match with contract tests. Do not hand-write a second `StatusResponse` type in the frontend. Do not treat FastAPI's auto-generated `/openapi.json` as the source of truth.

### Root README (written at implementation)

Root `README.md` MUST include:

- Project name: FlyAccounts (foundation stage — working-and-connected page only; no accounting features)
- Stack: React, FastAPI, PostgreSQL, S3-compatible storage
- Layout: `frontend/`, `backend/`, `deployment/`
- Start: copy `deployment/.env.example` to `deployment/.env`, then `docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build`
- What you should see: working message, connected successfully, database/storage reachability after a successful `GET /v1/status`
- Secrets: never commit `deployment/.env`
- Links: [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml) (single source of truth for the API)

Do not copy the full stop-backend / stop-postgres / stop-minio scripts into README; those stay in quickstart.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| VII Basic Security / XI Authorized Access — confirmation page is public; no sign-in | Spec Assumptions and Out of Scope defer identity. This stage has no user or financial data. FR-003/FR-004 require a working-and-connected page that may be opened without signing in. | Requiring auth now would add identity, sessions, and protected routes that the spec forbids. Dummy auth would violate XIII Production Grade. |

## Connection rule (spec FR-004 / FR-005)

- Status request fails (network, timeout, or backend unreachable): page says **not connected** and MUST NOT say connected successfully.
- Status request succeeds (HTTP 200): page says **connected successfully**.
- Database and storage appear only after a successful backend response; they do not redefine frontend-to-backend connection.
- Backend returns HTTP 200 whenever it can handle the request, even if DB or S3 is down, with `database` / `storage` set to `unavailable`.
