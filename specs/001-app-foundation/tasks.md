---
description: "Task list for App Foundation implementation"
---

# Tasks: App Foundation

**Input**: Design documents from `/specs/001-app-foundation/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included. Constitution III (test-first) and plan.md require contract tests against `contracts/openapi.yaml`. Write failing tests before implementation in user-story phases.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/`, `frontend/src/`, `deployment/`
- OpenAPI SSOT: `specs/001-app-foundation/contracts/openapi.yaml`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create directory tree `backend/app/{api,core,db,storage}`, `backend/alembic`, `backend/tests/{contract,integration,unit}`, `frontend/src/{pages,api}`, `frontend/tests`, and `deployment/` as specified in specs/001-app-foundation/plan.md
- [x] T002 Initialize Python 3.12 FastAPI project with Uvicorn, SQLAlchemy 2, Alembic, psycopg, boto3, OpenTelemetry, pytest, and httpx in backend/pyproject.toml
- [x] T003 [P] Initialize Vite React 18 TypeScript app with openapi-typescript, openapi-fetch, Vitest, and Testing Library in frontend/package.json
- [x] T004 [P] Write shared environment placeholders (DATABASE_URL, Postgres credentials, S3/MinIO endpoint/bucket/keys/region, CORS_ORIGINS, VITE_API_BASE_URL) in deployment/.env.example
- [x] T005 Create four-service Compose stack (frontend, backend, postgres, minio) referencing ../backend and ../frontend in deployment/docker-compose.yml
- [x] T006 [P] Add backend image build in backend/Dockerfile
- [x] T007 [P] Add frontend image build in frontend/Dockerfile

**Checkpoint**: Repository layout, package manifests, and shared deployment files exist

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T008 Load environment settings (DATABASE_URL, S3, CORS_ORIGINS) in backend/app/core/config.py
- [x] T009 [P] Configure OpenTelemetry FastAPI instrumentation in backend/app/core/telemetry.py
- [x] T010 [P] Add SQLAlchemy engine and SELECT 1 reachability helper in backend/app/db/session.py
- [x] T011 Initialize Alembic with an empty baseline revision (no business tables) in backend/alembic/
- [x] T012 [P] Add boto3 HeadBucket reachability helper in backend/app/storage/s3.py
- [x] T013 Create FastAPI app with CORS, /v1 prefix, and committed OpenAPI from specs/001-app-foundation/contracts/openapi.yaml (do not use auto-schema as SSOT) in backend/app/main.py
- [x] T014 Generate TypeScript schema from specs/001-app-foundation/contracts/openapi.yaml into frontend/src/api/schema.d.ts
- [x] T015 Create typed openapi-fetch client using generated schema and VITE_API_BASE_URL in frontend/src/api/client.ts

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Open the application and see that it works (Priority: P1) — MVP

**Goal**: Opening FlyAccounts shows one simple page that states the application is working, with no accounting features.

**Independent Test**: Start the application and open it. Confirm a simple working message is visible and that no accounting screens or forms appear.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation

- [x] T016 [P] [US1] Add failing test that the page states the application is working and shows no accounting UI in frontend/tests/StatusPage.test.tsx

### Implementation for User Story 1

- [x] T017 [US1] Create confirmation page stating the application is working in frontend/src/pages/StatusPage.tsx
- [x] T018 [US1] Add readable stacked layout CSS for phone, tablet, and desktop in frontend/src/pages/StatusPage.css
- [x] T019 [US1] Mount StatusPage as the only route in frontend/src/App.tsx and frontend/src/main.tsx

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - See that the parts are connected (Priority: P1)

**Goal**: The same page reports connected successfully when GET /v1/status returns HTTP 200, and not connected (with no success message) when the backend is unreachable. Database and storage reachability appear only after a successful response.

**Independent Test**: Open the page with both parts running and confirm a connected message. Stop the backend, refresh, and confirm the page reports not connected. After HTTP 200, database and storage show ok or unavailable per the contract.

### Tests for User Story 2

> Write these tests FIRST, ensure they FAIL before implementation

- [x] T020 [P] [US2] Add failing contract test that GET /v1/status matches specs/001-app-foundation/contracts/openapi.yaml in backend/tests/contract/test_status.py
- [x] T021 [P] [US2] Add failing tests for connected on HTTP 200, not connected on fetch failure, and never both, in frontend/tests/connectionStatus.test.tsx

### Implementation for User Story 2

- [x] T022 [US2] Implement GET /v1/status returning HTTP 200 with service, database, and storage per the YAML in backend/app/api/status.py
- [x] T023 [US2] Register the status router on the /v1 prefix in backend/app/main.py
- [x] T024 [US2] Call the generated client and show connected vs not connected plus database/storage only after HTTP 200 in frontend/src/pages/StatusPage.tsx

**Checkpoint**: User Stories 1 AND 2 both work; connection reporting is honest

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T025 [P] Write root README.md with stack, deployment start commands, expected working/connected messages, secrets warning, and links to specs/001-app-foundation/quickstart.md and specs/001-app-foundation/contracts/openapi.yaml
- [x] T026 [P] Add Compose-backed integration test for GET /v1/status against Postgres and MinIO in backend/tests/integration/test_status_stack.py
- [x] T027 Run validation scenarios in specs/001-app-foundation/quickstart.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 can proceed after Phase 2
  - User Story 2 uses the same page as US1 (T024 edits frontend/src/pages/StatusPage.tsx after T017)
- **Polish (Phase 5)**: Depends on User Stories 1 and 2 being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — no dependency on US2
- **User Story 2 (P1)**: Can start tests after Foundational (Phase 2). Page integration (T024) depends on US1 StatusPage existing

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Backend endpoint before frontend consumption of that endpoint
- Story complete before polish

### Parallel Opportunities

- T003 and T004 after T001
- T006 and T007 after T005
- T009, T010, and T012 after T008
- T016 after Phase 2
- T020 and T021 after Phase 2
- T025 and T026 after stories complete

---

## Parallel Example: User Story 1

```bash
Task: "Add failing test that the page states the application is working and shows no accounting UI in frontend/tests/StatusPage.test.tsx"
```

## Parallel Example: User Story 2

```bash
Task: "Add failing contract test that GET /v1/status matches specs/001-app-foundation/contracts/openapi.yaml in backend/tests/contract/test_status.py"
Task: "Add failing tests for connected on HTTP 200, not connected on fetch failure, and never both, in frontend/tests/connectionStatus.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. STOP and VALIDATE: working message visible, no accounting UI
5. Demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Demo (MVP)
3. Add User Story 2 → Test independently → Demo (connected vs not connected)
4. Polish: README, integration test, quickstart walkthrough

### Parallel Team Strategy

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (page)
   - Developer B: User Story 2 contract/backend tests and GET /v1/status
3. Merge onto the same StatusPage for T024

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group (Conventional Commits)
- Stop at any checkpoint to validate story independently
- `specs/001-app-foundation/contracts/openapi.yaml` is the single source of truth; frontend generates from it; do not hand-roll StatusResponse
- Out of scope: authentication, accounting modules, per-app Compose/env, file-upload APIs
- Avoid: vague tasks, same file conflicts, unofficial endpoints
