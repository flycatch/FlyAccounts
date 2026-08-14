---
description: "Task list for Microsoft Authentication with RBAC implementation"
---

# Tasks: Microsoft Authentication with RBAC

**Input**: Design documents from `/specs/002-microsoft-auth-rbac/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Included. Constitution III (test-first) and plan.md require contract tests against `specs/002-microsoft-auth-rbac/contracts/openapi.yaml`, plus unit and integration tests for access rules. Write failing tests before implementation in user-story phases.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/`, `frontend/src/`, `deployment/`
- OpenAPI SSOT: `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` (v2.0.0). Copy to `backend/contracts/openapi.yaml`. Frontend `generate:api` MUST point at this file, not `specs/001-app-foundation/contracts/openapi.yaml`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Point both apps at the v2.0.0 contract and add auth libraries and environment keys

- [X] T001 Copy `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` to `backend/contracts/openapi.yaml` and retarget `backend/contracts/README.md` to this feature
- [X] T002 [P] Point `generate:api` at `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` in `frontend/package.json`
- [X] T003 Add PyJWT and cryptography dependencies in `backend/pyproject.toml`
- [X] T004 [P] Add `@azure/msal-browser` dependency in `frontend/package.json`
- [X] T005 [P] Add placeholders (no real secrets) for `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `INITIAL_ADMIN_EMAIL`, `JWT_SIGNING_KEY`, `JWT_ACCESS_TTL_SECONDS` (900), `JWT_REFRESH_TTL_SECONDS` (604800), `VITE_MICROSOFT_CLIENT_ID`, and `VITE_MICROSOFT_TENANT_ID` in `deployment/.env.example`
- [X] T006 Pass the new backend env vars and frontend `VITE_MICROSOFT_*` build args in `deployment/docker-compose.yml`
- [X] T007 Add Entra, JWT, and `INITIAL_ADMIN_EMAIL` settings in `backend/app/core/config.py`
- [X] T008 [P] Declare `VITE_MICROSOFT_CLIENT_ID` and `VITE_MICROSOFT_TENANT_ID` in `frontend/src/vite-env.d.ts`
- [X] T009 Update CORS `allow_methods` to GET, POST, DELETE, set app version to 2.0.0, and retarget the OpenAPI fallback path to `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` in `backend/app/main.py`

**Checkpoint**: Contract copy, dependencies, and env keys exist; no user-story work yet

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Persistence, JWT/session primitives, combined-permission loading, and closing the public status API

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 [P] Create User model (`id`, `microsoft_oid`, `tenant_id`, `display_name`, `upn`, timestamps) in `backend/app/models/user.py`
- [X] T011 [P] Create Permission, Role, RolePermission, and RoleAssignment models in `backend/app/models/rbac.py`
- [X] T012 [P] Create RefreshToken model (`token_hash`, `family_id`, `expires_at`, `revoked_at`, `replaced_by_id`) in `backend/app/models/refresh_token.py`
- [X] T013 Export models from `backend/app/models/__init__.py`
- [X] T014 Add Alembic revision `0002_auth_rbac` that creates the tables and seeds Permission codes (`access_administration`, `view_sensitive_financial_fields`, `finance_landing`, `hr_landing`, `pmo_landing`) plus roles Entity Admin, Finance User, HR User, and PMO User per `research.md` in `backend/alembic/versions/0002_auth_rbac.py`
- [X] T015 Import the new models into Alembic metadata in `backend/alembic/env.py`
- [X] T016 Implement HMAC access-JWT issue/verify (`sub` = User.id; claims MUST NOT include roles or permissions) in `backend/app/core/security.py`
- [X] T017 Implement opaque refresh-token SHA-256 hash, rotate (`revoked_at` / `replaced_by_id`), and family-revoke helpers in `backend/app/core/security.py`
- [X] T018 [P] Implement combined-permissions loader as the union of `Permission.code` for a user’s RoleAssignments in `backend/app/core/permissions.py`
- [X] T019 [P] Add ErrorResponse helpers matching OpenAPI codes (`invalid_token`, `personal_account`, `unknown_tenant`, `unauthorized`, `forbidden`, `pending_access`, `not_found`, `duplicate_assignment`, `last_admin_required`) in `backend/app/core/errors.py`
- [X] T020 Add Bearer dependencies that verify the access JWT, load the User, attach combined permissions, and return 401 `unauthorized` in `backend/app/core/deps.py`
- [X] T021 Add a require-at-least-one-role dependency that returns 403 `pending_access` in `backend/app/core/deps.py`
- [X] T022 Require a valid access JWT and at least one role on `GET /v1/status` (401 unsigned, 403 pending) in `backend/app/api/status.py`
- [X] T023 Update `backend/tests/contract/test_status.py` to load `specs/002-microsoft-auth-rbac/contracts/openapi.yaml`, expect 401 without Bearer, 403 with a no-role JWT, and 200 with an authorized JWT
- [X] T024 [P] Generate TypeScript types from `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` into `frontend/src/api/schema.d.ts`
- [X] T025 Send `Authorization: Bearer` from `localStorage` key `flyaccounts.accessToken` in `frontend/src/api/client.ts`
- [X] T026 Extend `backend/tests/conftest.py` with OpenAPI path to this feature’s YAML plus helpers to issue test access JWTs and seed users/roles

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Sign in with Microsoft (Priority: P1) 🎯 MVP

**Goal**: Unsigned visitors must complete organizational Microsoft sign-in. A valid ID token is exchanged for a FlyAccounts access JWT and refresh token stored in `localStorage`. Personal/unknown-directory tokens are rejected. The configured `INITIAL_ADMIN_EMAIL` receives the seeded role that includes `access_administration` on first match.

**Independent Test**: Open the application unsigned, complete Microsoft sign-in with a valid organizational account, and confirm the person is in the application (`localStorage` has `flyaccounts.accessToken` and `flyaccounts.refreshToken`). Cancel or fail sign-in and confirm they cannot reach any signed-in screen. A personal Microsoft account is not granted access.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T027 [P] [US1] Add failing contract tests for `POST /v1/auth/microsoft` (200 TokenResponse, 401 `invalid_token` / `personal_account` / `unknown_tenant`) against `specs/002-microsoft-auth-rbac/contracts/openapi.yaml` in `backend/tests/contract/test_auth_microsoft.py`
- [X] T028 [P] [US1] Add failing contract tests for `POST /v1/auth/refresh` (200 new pair, 401 unknown/expired/reused) in `backend/tests/contract/test_auth_refresh.py`
- [X] T029 [P] [US1] Add failing unit tests for Microsoft ID-token JWKS validation (iss, aud, tid, expiry, personal/unknown tenant) in `backend/tests/unit/test_microsoft_token.py`
- [X] T030 [P] [US1] Add failing unit tests that access JWTs omit roles/permissions and that refresh rotation plus family-revoke on reuse work in `backend/tests/unit/test_tokens.py`
- [X] T031 [P] [US1] Add failing unit tests for case-insensitive `INITIAL_ADMIN_EMAIL` bootstrap (match `preferred_username` / `email`, assign once, no-match stays pending) in `backend/tests/unit/test_initial_admin.py`
- [X] T032 [P] [US1] Add failing compose-backed integration tests that exchange a mocked-JWKS Microsoft token and rotate refresh in `backend/tests/integration/test_microsoft_exchange.py`
- [X] T033 [P] [US1] Add failing tests that the unsigned app shows Microsoft sign-in, cancel/fail stays unsigned, and tokens are written to `localStorage` in `frontend/tests/SignInPage.test.tsx`

### Implementation for User Story 1

- [X] T034 [US1] Validate Microsoft ID tokens via JWKS for the configured tenant and SPA client id (reject personal/unknown-directory; do not create a User) in `backend/app/core/microsoft.py`
- [X] T035 [US1] Upsert User on accepted sign-in and bootstrap the seeded `access_administration` role when `INITIAL_ADMIN_EMAIL` matches in `backend/app/core/bootstrap.py`
- [X] T036 [US1] Build `MeResponse` (identity, assigned role names, combined permission codes, `landing.accessState` pending vs authorized, empty `sections`) in `backend/app/core/me.py`
- [X] T037 [US1] Implement `POST /v1/auth/microsoft` (exchange ID token, issue access JWT + opaque refresh, return TokenResponse) in `backend/app/api/auth.py`
- [X] T038 [US1] Implement `POST /v1/auth/refresh` (rotate valid token; family-revoke and 401 on reuse; never issue a pair for expired/unknown) in `backend/app/api/auth.py`
- [X] T039 [US1] Register the auth router on `/v1` in `backend/app/main.py`
- [X] T040 [P] [US1] Configure `@azure/msal-browser` with `VITE_MICROSOFT_TENANT_ID` / `VITE_MICROSOFT_CLIENT_ID` and authority `https://login.microsoftonline.com/{tenantId}` in `frontend/src/auth/msal.ts`
- [X] T041 [P] [US1] Add `localStorage` helpers for `flyaccounts.accessToken` and `flyaccounts.refreshToken` in `frontend/src/auth/tokens.ts`
- [X] T042 [US1] On 401, call `POST /v1/auth/refresh` once, replace both tokens, and retry the original request in `frontend/src/auth/refresh.ts` and `frontend/src/api/client.ts`
- [X] T043 [US1] Build SignInPage that starts the Microsoft prompt, posts the ID token to `POST /auth/microsoft` via the generated client, stores the pair, and stays unsigned on cancel/reject in `frontend/src/pages/SignInPage.tsx` and `frontend/src/pages/SignInPage.css`
- [X] T044 [US1] Route unsigned visitors to SignInPage (do not show StatusPage, pending access, combined landing, or access administration as a public home) in `frontend/src/App.tsx`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Access requires a recognized role (Priority: P1)

**Goal**: A signed-in person with zero RoleAssignments sees only pending access. Combined landing, access administration, and `GET /v1/status` are refused until a role is assigned.

**Independent Test**: Sign in as a person who has never been assigned a role. Confirm pending access is shown and that the combined landing and access administration are not reachable. `GET /v1/status` is 403.

### Tests for User Story 2

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T045 [P] [US2] Add failing contract tests for `GET /v1/me` (200 pending with empty roles/permissions/sections; 401 unsigned) against the YAML in `backend/tests/contract/test_me.py`
- [X] T046 [P] [US2] Add failing tests that a no-role session is routed to pending access and cannot open landing or access administration in `frontend/tests/PendingAccessPage.test.tsx`

### Implementation for User Story 2

- [X] T047 [US2] Implement `GET /v1/me` for any signed-in person using `backend/app/core/me.py` in `backend/app/api/me.py`
- [X] T048 [US2] Register the me router on `/v1` in `backend/app/main.py`
- [X] T049 [US2] Build PendingAccessPage (pending message only; no landing, admin, or status confirmation) in `frontend/src/pages/PendingAccessPage.tsx` and `frontend/src/pages/PendingAccessPage.css`
- [X] T050 [US2] After sign-in, call `GET /me` and route `accessState: pending` to PendingAccessPage (and keep unsigned users on SignInPage) in `frontend/src/App.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Assign and change roles (Priority: P1)

**Goal**: A caller whose combined permissions include `access_administration` can list signed-in people and existing roles, assign a role (add, never replace, never duplicate), and revoke one role. Revoke that would leave zero people with `access_administration` is refused.

**Independent Test**: Sign in as a person whose combined permissions include access-administration, assign two different existing roles to one signed-in person, revoke one of those roles, attempt to assign the same role twice, and confirm the last person with access-administration cannot have that access removed.

### Tests for User Story 3

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T051 [P] [US3] Add failing contract tests for `GET /v1/people` and `GET /v1/roles` (200 for admin, 401 unsigned, 403 without `access_administration`) in `backend/tests/contract/test_people_roles.py`
- [X] T052 [P] [US3] Add failing contract tests for `POST /v1/people/{userId}/roles` and `DELETE /v1/people/{userId}/roles/{roleId}` (200, 403, 404, 409 `duplicate_assignment` / `last_admin_required`) in `backend/tests/contract/test_assign_revoke.py`
- [X] T053 [P] [US3] Add failing unit tests for add-not-replace, unique `(user_id, role_id)`, and last-admin by combined permission (not role display name) in `backend/tests/unit/test_role_assignment.py`
- [X] T054 [P] [US3] Add failing tests that access administration lists people/roles, assigns, refuses duplicates, and shows a last-admin message in `frontend/tests/AccessAdminPage.test.tsx`

### Implementation for User Story 3

- [X] T055 [US3] Implement last-admin guard (refuse revoke when zero remaining users would have `access_administration` in their combined set) in `backend/app/core/permissions.py`
- [X] T056 [US3] Implement `GET /v1/people`, `GET /v1/roles`, `POST /v1/people/{userId}/roles`, and `DELETE /v1/people/{userId}/roles/{roleId}` (assign adds; 409 duplicate; 409 last admin) in `backend/app/api/people.py`
- [X] T057 [US3] Register the people router on `/v1` in `backend/app/main.py`
- [X] T058 [US3] Build AccessAdminPage that lists signed-in people, lists existing roles from `GET /roles`, assigns without replacing, revokes one role, and surfaces `duplicate_assignment` / `last_admin_required` in `frontend/src/pages/AccessAdminPage.tsx` and `frontend/src/pages/AccessAdminPage.css`
- [X] T059 [US3] Show access administration only when combined permissions include `access_administration`; refuse it for pending and non-admin authorized users in `frontend/src/App.tsx`

**Checkpoint**: User Stories 1, 2, and 3 all work independently

---

## Phase 6: User Story 4 - Combined landing follows all assigned roles (Priority: P1)

**Goal**: A person with one or more roles lands on one home that states their name, lists every assigned role name, and shows only what the combined permissions allow. `cost` / `margin` appear only when `view_sensitive_financial_fields` is in that set (omitted from the payload otherwise). Working-and-connected confirmation is available on or beside this landing, not as a public home.

**Independent Test**: Assign two existing roles with different permissions to one person. Open the application and confirm the landing lists both roles, shows the union of allowed sections, and does not show content outside that union. Compare with a second person who has only one of those roles. Sensitive fields appear if and only if the combined set includes `view_sensitive_financial_fields`.

### Tests for User Story 4

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T060 [P] [US4] Extend failing contract tests in `backend/tests/contract/test_me.py` for authorized `GET /v1/me`: sections only for permitted codes; `sensitiveFinancialFields` present iff `view_sensitive_financial_fields` is in the combined set
- [X] T061 [P] [US4] Add failing unit tests that demo `cost`/`margin` are omitted from the payload when the permission is absent (never CSS-only hiding) in `backend/tests/unit/test_landing_fields.py`
- [X] T062 [P] [US4] Add failing tests that CombinedLandingPage lists name and every role, renders only returned sections/fields, and does not invent cost/margin in `frontend/tests/CombinedLandingPage.test.tsx`
- [X] T063 [P] [US4] Update `frontend/tests/StatusPage.test.tsx` and `frontend/tests/connectionStatus.test.tsx` so status confirmation is shown only for authorized sessions (unsigned never sees it as a public home)

### Implementation for User Story 4

- [X] T064 [US4] Add landing `sections` for each of `finance_landing`, `hr_landing`, and `pmo_landing` present in the combined set, and include derived demo `sensitiveFinancialFields` only when `view_sensitive_financial_fields` is present, in `backend/app/core/me.py`
- [X] T065 [US4] Build CombinedLandingPage that states the person’s name, lists every assigned role name, and renders only `landing.sections` and `landing.sensitiveFinancialFields` from `GET /me` in `frontend/src/pages/CombinedLandingPage.tsx` and `frontend/src/pages/CombinedLandingPage.css`
- [X] T066 [US4] Show StatusPage on or beside the combined landing (authorized only); keep honesty: HTTP 200 → connected, fetch failure → not connected, in `frontend/src/pages/StatusPage.tsx` and `frontend/src/App.tsx`
- [X] T067 [US4] Route `accessState: authorized` to CombinedLandingPage and keep pending users off that landing in `frontend/src/App.tsx`

**Checkpoint**: User Stories 1–4 all work independently

---

## Phase 7: User Story 5 - Sign out (Priority: P2)

**Goal**: A signed-in person can sign out. The server revokes the refresh token family. The client clears `localStorage`. The next visit requires Microsoft sign-in again.

**Independent Test**: Sign in, open a landing or pending access, sign out, and confirm the next visit requires Microsoft sign-in and does not show the previous landing.

### Tests for User Story 5

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T068 [P] [US5] Add failing contract tests for `POST /v1/auth/logout` (204; 401 without access JWT; presented refresh family is revoked) in `backend/tests/contract/test_auth_logout.py`
- [X] T069 [P] [US5] Add failing tests that sign-out clears `flyaccounts.accessToken` / `flyaccounts.refreshToken` and returns the visitor to SignInPage in `frontend/tests/SignOut.test.tsx`

### Implementation for User Story 5

- [X] T070 [US5] Implement `POST /v1/auth/logout` (Bearer required; revoke presented refresh token and its family; 204) in `backend/app/api/auth.py`
- [X] T071 [US5] Add a sign-out control on pending access and combined landing that calls logout, clears `localStorage`, and returns to SignInPage in `frontend/src/pages/PendingAccessPage.tsx`, `frontend/src/pages/CombinedLandingPage.tsx`, and `frontend/src/auth/tokens.ts`
- [X] T072 [US5] Treat missing/invalid tokens and failed refresh as unsigned and refuse previous landing/admin URLs until Microsoft sign-in in `frontend/src/App.tsx`

**Checkpoint**: All user stories are independently functional

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility, telemetry, and quickstart validation across stories

- [X] T073 [P] Update root `README.md` to require Microsoft sign-in, list the new env keys, and link `specs/002-microsoft-auth-rbac/quickstart.md` and `specs/002-microsoft-auth-rbac/contracts/openapi.yaml`
- [X] T074 [P] Ensure SignInPage, PendingAccessPage, CombinedLandingPage, and AccessAdminPage are readable on phone/tablet/desktop and keyboard-usable in `frontend/src/pages/*.css`
- [X] T075 Confirm OpenTelemetry traces cover auth, me, people, and status request paths in `backend/app/core/telemetry.py` and `backend/app/main.py`
- [X] T076 Confirm there is no dummy, bypass, or local-password sign-in path in `frontend/src/` and `backend/app/`, and that `deployment/.env.example` holds placeholders only
- [X] T077 Run the validation walkthrough in `specs/002-microsoft-auth-rbac/quickstart.md` (unsigned sign-in, initial admin, pending user, assign/revoke, landing union, status 401/403/200, refresh, sign-out)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - Sequential delivery: US1 → US2 → US3 → US4 → US5
  - After Foundational, backend contract tests for later stories can be written in parallel
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — Microsoft exchange, tokens, SignInPage. No dependency on other stories
- **User Story 2 (P1)**: After US1 session — pending access UI and `GET /me`. Independently testable with a no-role user
- **User Story 3 (P1)**: After US1 (people exist after sign-in). Independently testable with seeded assignments; admin UI is this story
- **User Story 4 (P1)**: After US2 routing. Landing payload can be tested by seeding RoleAssignments without the admin UI; live assign demo uses US3
- **User Story 5 (P2)**: After US1. Sign-out control should appear on pending (US2) and landing (US4) screens

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models (Phase 2) before auth services
- Token issue before Microsoft exchange
- `MeResponse` builder before `GET /me` and before landing sections
- Combined-permission checks before people/assign endpoints
- Story complete before moving to the next priority when staffing is sequential

### Parallel Opportunities

- Phase 1: T002, T004, T005, T008 can run in parallel with T001/T003
- Phase 2: T010, T011, T012 can run in parallel; T018 and T019 can run in parallel; T024 can run once T002 is done
- US1 tests T027–T033 can run in parallel; T040 and T041 can run in parallel
- US2 tests T045–T046 in parallel
- US3 tests T051–T054 in parallel
- US4 tests T060–T063 in parallel
- US5 tests T068–T069 in parallel
- After Foundational, one developer can take US1 while another writes US3 contract tests against the YAML

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Add failing contract tests for POST /v1/auth/microsoft in backend/tests/contract/test_auth_microsoft.py"
Task: "Add failing contract tests for POST /v1/auth/refresh in backend/tests/contract/test_auth_refresh.py"
Task: "Add failing unit tests for Microsoft ID-token JWKS validation in backend/tests/unit/test_microsoft_token.py"
Task: "Add failing unit tests for JWT claims and refresh rotation in backend/tests/unit/test_tokens.py"
Task: "Add failing unit tests for INITIAL_ADMIN_EMAIL bootstrap in backend/tests/unit/test_initial_admin.py"
Task: "Add failing integration tests with mocked JWKS in backend/tests/integration/test_microsoft_exchange.py"
Task: "Add failing SignInPage tests in frontend/tests/SignInPage.test.tsx"

# Launch independent frontend auth files together (after tests):
Task: "Configure MSAL in frontend/src/auth/msal.ts"
Task: "Add localStorage token helpers in frontend/src/auth/tokens.ts"
```

---

## Parallel Example: User Story 3

```bash
# Launch all US3 tests together:
Task: "Contract tests for GET /people and GET /roles in backend/tests/contract/test_people_roles.py"
Task: "Contract tests for assign/revoke in backend/tests/contract/test_assign_revoke.py"
Task: "Unit tests for duplicate assignment and last-admin in backend/tests/unit/test_role_assignment.py"
Task: "AccessAdminPage tests in frontend/tests/AccessAdminPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories; closes public `GET /v1/status`)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Unsigned visit shows Microsoft sign-in; organizational sign-in stores tokens; cancel/personal account stays unsigned
5. Demo identity before role administration

### Incremental Delivery

1. Setup + Foundational → contract, models, JWT, status no longer public
2. User Story 1 → Microsoft sign-in (MVP)
3. User Story 2 → pending access for no-role users
4. User Story 3 → assign/revoke existing roles
5. User Story 4 → combined landing + standing field policy + authenticated status
6. User Story 5 → sign-out
7. Each story adds value without reopening dummy auth or a public confirmation page

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (auth API + SignInPage)
   - Developer B: User Story 3 contract/unit tests and `backend/app/api/people.py` (can seed users in tests)
   - Developer C: User Story 2/4 frontend pages against mocked `GET /me`
3. Integrate on `GET /me` + App routing, then US5 sign-out

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to a specific user story for traceability
- Authorization MUST use combined permission codes from PostgreSQL on every request, never role display names or JWT claims
- Do not add APIs to create or edit roles/permissions; use seeded rows from `0002_auth_rbac`
- Do not store demo cost/margin as money columns
- Secrets and `INITIAL_ADMIN_EMAIL` live in `deployment/.env` only
- Commit after each task or logical group using Conventional Commits
- Stop at any checkpoint to validate the story independently
