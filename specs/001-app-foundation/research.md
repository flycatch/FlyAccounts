# Research: App Foundation

## Stack

**Decision**: Python 3.12 + FastAPI (Uvicorn) for the backend; TypeScript + React 18 + Vite for the frontend.

**Rationale**: The feature requires one backend and one separate frontend (FR-001, constitution I). FastAPI is the HTTP server; the committed OpenAPI YAML is the contract, not FastAPI's auto-generated schema. Vite + React 18 is a small, ordinary frontend stack (constitution XVI) sufficient for a single confirmation page.

**Alternatives considered**: Django/Flask (weaker first-class OpenAPI); Next.js (extra server layer not needed); CRA (unmaintained). Rejected as heavier or less aligned with a published contract.

## Published contract

**Decision**: [contracts/openapi.yaml](./contracts/openapi.yaml) is the **single source of truth**. Single operation `GET /v1/status`. The backend implements that document and is tested against it. The frontend MUST consume it by generating TypeScript types and an `openapi-fetch` client from the same YAML (build step). Do not hand-roll a parallel status type. Do not treat FastAPI's auto-generated OpenAPI as the contract.

**Rationale**: FR-002, FR-007, and constitution II require a published, versioned working-and-connected check before it is offered, and that the frontend use that contract. A generated client from the YAML is the smallest way to keep frontend and backend matched. Copying or generating from `specs/` into each app keeps source trees decoupled (constitution XIV).

**Alternatives considered**: Hand-written typed `fetch` (can drift from the YAML); GraphQL; unversioned `/health`; using FastAPI `/openapi.json` as SSOT (Python models become the contract); a shared runtime package of types (shared source, forbidden by constitution XIV). Rejected.

## Authentication deferred

**Decision**: The confirmation page and `GET /v1/status` are public. No sign-in, roles, or tokens in this stage.

**Rationale**: Spec Assumptions allow opening the page without signing in. Auth is listed as Out of Scope. This stage has no user or financial data. Secrets still MUST NOT be committed (FR-008, constitution VII/XII).

**Alternatives considered**: Require login now; dummy/hard-coded auth. Login expands scope past the spec. Dummy auth violates constitution XIII (Production Grade).

## PostgreSQL and Alembic

**Decision**: PostgreSQL 16 with SQLAlchemy 2, psycopg, and Alembic. This stage ships a baseline/empty migration only. Runtime check is `SELECT 1`. No business tables.

**Rationale**: Chosen storage for FlyAccounts. Constitution XV requires versioned schema changes via migrations, not auto-rewrite on startup. The spec has no persisted entities, so a baseline revision plus a reachability check is enough. Status reports `database: ok | unavailable` without failing the HTTP request (see Connection rule in plan.md).

**Alternatives considered**: SQLite; creating placeholder business tables; skipping Alembic until the first entity. SQLite would not match the chosen stack. Placeholder tables invent accounting schema. Skipping Alembic would force auto-create later and violate constitution XV.

## S3-compatible storage

**Decision**: boto3 client from environment config. Local MinIO in Compose. Status uses `HeadBucket` only. No upload, download, or object APIs.

**Rationale**: Chosen file storage for later features. Wiring a real bucket check now proves the foundation without adding file features the spec forbids. `HeadBucket` is the smallest honest reachability probe.

**Alternatives considered**: AWS-only SDK defaults with no local stand-in; a file-upload API; skipping storage until a later spec. No local stand-in would block quickstart. Upload APIs are out of scope. Skipping storage would leave the chosen stack unwired.

## Shared deployment folder

**Decision**: One root `deployment/` folder with `docker-compose.yml` and `.env.example`. Four Compose services: `frontend`, `backend`, `postgres`, `minio`. App Dockerfiles stay at `backend/Dockerfile` and `frontend/Dockerfile`. No Compose or `.env` files under `frontend/` or `backend/`.

**Rationale**: Operational readiness (constitution XII) needs a single way to configure and start the stack. Sharing one env and one Compose file avoids duplicated secrets and per-app stacks (constitution I, VI). Dockerfiles belong with each app so each can still build on its own (constitution XIV).

**Alternatives considered**: Compose at repo root; per-app compose/env; infrastructure-only compose (Postgres + MinIO) with apps started by hand. Root clutter and split env files make secrets easier to copy wrong. Hand-starting apps is not required as a user story, but a shared stack is the simplest repeatable validation path.

## Root README

**Decision**: One root `README.md`. No `frontend/README.md` or `backend/README.md`.

**Rationale**: Operational readiness (constitution XII) needs a single start path (`deployment/`). Quickstart stays the spec validation guide; README stays short and links to it.

**Alternatives considered**: Per-app READMEs (duplication); putting all SC-001–SC-005 steps only in README (would replace quickstart).

## Environment and secrets

**Decision**: All secrets and environment-specific values live in `deployment/.env` (gitignored). `deployment/.env.example` is committed with placeholders for `DATABASE_URL`, Postgres credentials, S3/MinIO endpoint, bucket, keys, region, `CORS_ORIGINS`, and `VITE_API_BASE_URL`.

**Rationale**: FR-008 and constitution VII/XII forbid committed secrets. One example file is the source of truth for required keys.

**Alternatives considered**: `.env` files inside each app; committed real credentials for local convenience. Rejected as duplication or a secret leak.

## UI

**Decision**: One React page with ordinary HTML and plain CSS. No component library. Messages: application is working; connected successfully or not connected; database and storage reachability only after a successful status response.

**Rationale**: FR-003 through FR-006 and FR-009. Constitution IX and XVI: readable on phone, tablet, and desktop; no large extra UI libraries.

**Alternatives considered**: Material UI / Ant Design; a dashboard layout. Extra libraries and dashboard chrome are out of scope and would look like a product home, which the spec forbids.

## Telemetry

**Decision**: OpenTelemetry FastAPI instrumentation on the `GET /v1/status` request path. No extra monitoring stack (no Prometheus/Grafana/Jaeger product suite).

**Rationale**: Constitution V requires basic traces on new request paths. A status endpoint is a new path.

**Alternatives considered**: No telemetry until finance features; a full observability platform. The first violates the constitution gate; the second violates V and VI.

## Testing

**Decision**: pytest + httpx for backend tests. Contract tests MUST validate responses against `contracts/openapi.yaml`. Vitest + Testing Library for frontend using the generated client. One Compose-backed path that exercises `GET /v1/status` against real Postgres and MinIO.

**Rationale**: Constitution III (tests before production code) and IV (backend and frontend together). Tests must prove working vs connected vs not connected (SC-001–SC-003) and absence of accounting UI (SC-004).

**Alternatives considered**: Unit tests only; a heavy end-to-end framework as the only suite. Unit-only fails constitution IV. A large E2E-only approach is more than this page needs.

## Frontend–backend communication

**Decision**: The frontend generated client calls `GET /v1/status` using `VITE_API_BASE_URL`. Request and response types come only from the generated schema. Backend enables CORS from `CORS_ORIGINS`. HTTP 200 whenever the backend handles the request; body matches `StatusResponse` in the YAML. Network/timeout/unreachable → frontend shows not connected.

**Rationale**: Matches FR-004/FR-005 without treating DB or S3 failure as “frontend cannot reach backend.” Returning 503 on DB/S3 failure would make a reachable backend look disconnected. Generating from the YAML keeps the page matched to the backend contract.

**Alternatives considered**: Backend 503 when DB or S3 is down; a BFF; sharing a database with the frontend; a hand-written status client. 503 conflates connection with infrastructure. A BFF is an extra application (constitution I). Shared DB violates constitution XIV. A hand-written client can diverge from the YAML.
