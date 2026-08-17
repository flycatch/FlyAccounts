---
description: "Task list for Settings User Management implementation"
---

# Tasks: Settings User Management

**Input**: Design documents from `/specs/003-user-management/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md, ui-spec.md

**Tests**: Included. Constitution III (test-first) and plan.md require contract tests against `specs/003-user-management/contracts/openapi.yaml`, plus unit and integration tests for invite consume, organization entry, last-admin (signed-in Users only), role CRUD, and cancel/remove. Write failing tests before implementation in user-story phases.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app**: `backend/app/`, `frontend/src/`, `deployment/`
- OpenAPI SSOT: `specs/003-user-management/contracts/openapi.yaml` (v3.0.0). Copy to `backend/contracts/openapi.yaml`. Frontend `generate:api` MUST point at this file, not `specs/002-microsoft-auth-rbac/contracts/openapi.yaml`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Point both apps at the v3.0.0 contract, allow PATCH, and load Settings typography. No new env secrets (002 keys only).

- [X] T001 Copy `specs/003-user-management/contracts/openapi.yaml` to `backend/contracts/openapi.yaml` and retarget `backend/contracts/README.md` to this feature
- [X] T002 [P] Point `generate:api` at `specs/003-user-management/contracts/openapi.yaml` in `frontend/package.json`
- [X] T003 Update CORS `allow_methods` to GET, POST, PATCH, DELETE, set app version to 3.0.0, and retarget the OpenAPI fallback path to `specs/003-user-management/contracts/openapi.yaml` in `backend/app/main.py`
- [X] T004 [P] Load Plus Jakarta Sans and Work Sans from Google Fonts in `frontend/index.html`

**Checkpoint**: Contract copy, PATCH CORS, and fonts exist; no user-story work yet

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Invite persistence, permission module/action metadata, error codes, and last-admin helpers that all stories share

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 [P] Add nullable `entry_path` (`invite` or `organization`) on User in `backend/app/models/user.py`
- [X] T006 [P] Create Invite (`email`, `invited_by_user_id`, `consumed_at`, `cancelled_at`) and InviteRole models with unique `(invite_id, role_id)` in `backend/app/models/invite.py`
- [X] T007 [P] Add required `module` and nullable `action` on Permission in `backend/app/models/rbac.py`
- [X] T008 Export Invite and InviteRole from `backend/app/models/__init__.py` so Alembic metadata via `backend/alembic/env.py` includes them
- [X] T009 Add Alembic revision `0003_user_management` that creates `invites` and `invite_roles`, unique index on `lower(trim(email))` for active invites, nullable `users.entry_path`, and backfills `permissions.module` / `permissions.action` per `data-model.md` in `backend/alembic/versions/0003_user_management.py`
- [X] T010 [P] Add ErrorResponse helpers matching OpenAPI codes (`duplicate_invite`, `already_present`, `duplicate_role_name`, `duplicate_permission`, `role_still_assigned`) in `backend/app/core/errors.py`
- [X] T011 Generalize last-admin to count signed-in Users only (unused invites do not count) and add helpers for revoke, detach, delete-role, and remove-person in `backend/app/core/permissions.py`
- [X] T012 [P] Generate TypeScript types from `specs/003-user-management/contracts/openapi.yaml` into `frontend/src/api/schema.d.ts`
- [X] T013 Point `FEATURE_OPENAPI` at this feature’s YAML, seed permission `module`/`action`, and add invite helpers in `backend/tests/conftest.py`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 1 - Open User Management from Settings (Priority: P1) 🎯 MVP

**Goal**: A person whose combined permissions include `access_administration` opens Settings and reaches Users, Roles, and Permissions. Combined landing remains Home. Standalone access administration is gone. People without that permission do not see Settings and cannot open it (APIs return 403).

**Independent Test**: Sign in as a person with access-administration and confirm Settings → Users / Roles / Permissions opens. Sign in as a person without that permission (or pending access) and confirm Settings is not offered and cannot be opened.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T014 [P] [US1] Update failing contract tests for `GET /v1/people` Person union shape (`personType`, `email`, `status`, optional `displayName`/`entryPath`) and `GET /v1/roles` with attached `permissions[]` against `specs/003-user-management/contracts/openapi.yaml` in `backend/tests/contract/test_people_roles.py`
- [X] T015 [P] [US1] Add failing contract tests for `GET /v1/permissions` (200 catalog for admin, 401 unsigned, 403 without `access_administration`) in `backend/tests/contract/test_permissions.py`
- [X] T016 [P] [US1] Add failing tests that Settings nav shows Users, Roles, and Permissions only when `access_administration` is present, and pending/non-admin sessions cannot open Settings, in `frontend/tests/SettingsNav.test.tsx`
- [X] T017 [P] [US1] Replace `frontend/tests/AccessAdminPage.test.tsx` with failing UsersPage tests for signed-in people list, status chips, and existing user assign/revoke in `frontend/tests/UsersPage.test.tsx`

### Implementation for User Story 1

- [X] T018 [P] [US1] Update `GET /v1/people` user payload to Person schema (`personType=user`, `email`, `status` pending or active, optional `entryPath`/`displayName`) in `backend/app/api/people.py`
- [X] T019 [P] [US1] Move `GET /v1/roles` into `backend/app/api/roles.py` returning Role with attached Permission rows (`code`, `module`, optional `action`)
- [X] T020 [P] [US1] Implement read-only `GET /v1/permissions` (no POST/PATCH/DELETE on permission types) in `backend/app/api/permissions.py`
- [X] T021 [US1] Register the roles and permissions routers on `/v1` in `backend/app/main.py`
- [X] T022 [P] [US1] Add Figma CSS variables from `specs/003-user-management/ui-spec.md` and import them in `frontend/src/styles/tokens.css` and `frontend/src/main.tsx`
- [X] T023 [P] [US1] Build app shell and Settings sidebar (Home + Settings group Users / Roles / Permissions; collapse on small widths) in `frontend/src/layout/AppShell.tsx`, `frontend/src/layout/Sidebar.tsx`, and `frontend/src/layout/AppShell.css`
- [X] T024 [US1] Build UsersPage listing signed-in people with status chips and existing user assign/revoke (port from AccessAdminPage; no invite form yet) in `frontend/src/pages/settings/UsersPage.tsx` and `frontend/src/pages/settings/UsersPage.css`
- [X] T025 [P] [US1] Build RolesPage as a read-only list of roles and attached permissions in `frontend/src/pages/settings/RolesPage.tsx` and `frontend/src/pages/settings/RolesPage.css`
- [X] T026 [P] [US1] Build PermissionsPage as a read-only catalog grouped by `module` with no create/edit control in `frontend/src/pages/settings/PermissionsPage.tsx` and `frontend/src/pages/settings/PermissionsPage.css`
- [X] T027 [US1] Replace AccessAdminPage with Settings views in `frontend/src/App.tsx`; keep combined landing as Home; hide Settings without `access_administration`; delete `frontend/src/pages/AccessAdminPage.tsx` and `frontend/src/pages/AccessAdminPage.css`

**Checkpoint**: User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Invite a person (Priority: P1)

**Goal**: A person with access-administration invites someone by organizational work email with zero or more existing roles. Duplicate active invites and emails that already belong to a listed User are refused. Invite is an in-app record (no outbound email). Invited people cannot use the application until they sign in.

**Independent Test**: From Settings → Users, invite one email with two roles and another with no roles. Confirm both appear as invited, a duplicate invite is refused, and an email that already belongs to a signed-in person cannot be invited.

### Tests for User Story 2

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T028 [P] [US2] Add failing contract tests for `POST /v1/people/invites` (201 with and without `roleIds`, 403, 404 unknown role, 409 `duplicate_invite` / `already_present`) in `backend/tests/contract/test_invites.py`
- [X] T029 [P] [US2] Add failing unit tests for unique active invite on `lower(trim(email))`, `already_present` vs listed `User.upn`, and zero-role invites in `backend/tests/unit/test_invites.py`
- [X] T030 [P] [US2] Add failing tests that UsersPage invites with two roles and with no roles, shows `invited` status, and surfaces `duplicate_invite` / `already_present` in `frontend/tests/UsersPage.test.tsx`

### Implementation for User Story 2

- [X] T031 [US2] Implement `POST /v1/people/invites` (zero or more existing `roleIds`; no outbound email) in `backend/app/api/people.py`
- [X] T032 [US2] Include active Invites in `GET /v1/people` (`personType=invite`, `status=invited`, `email`, roles from InviteRole) in `backend/app/api/people.py`
- [X] T033 [US2] Add invite form (work email + optional existing roles) to `frontend/src/pages/settings/UsersPage.tsx`

**Checkpoint**: User Stories 1 and 2 both work independently

---

## Phase 5: User Story 3 - Sign-in follows combined permissions (Priority: P1)

**Goal**: After Microsoft sign-in, an invited person consumes a matching unused invite (case-insensitive email). Roles are copied; `entry_path=invite`. Combined landing lists every assigned role and only the union of permission codes. If combined permissions still lack `access_administration` and work email matches `INITIAL_ADMIN_EMAIL`, assign the seeded admin role (do not skip because the invite attached other roles). Standing field policy is unchanged.

**Independent Test**: Invite one person with two roles that have different permissions and another with no roles. After each signs in, the first sees the union of both roles and nothing outside it; the second sees only pending access.

### Tests for User Story 3

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T034 [P] [US3] Add failing unit tests that invite consume copies InviteRoles to RoleAssignments (skip duplicates), matches email case-insensitively, sets `entry_path=invite`, and initial-admin bootstrap still runs when combined permissions lack `access_administration` in `backend/tests/unit/test_invite_consume.py`
- [X] T035 [P] [US3] Extend failing compose-backed integration tests so a matching-email Microsoft exchange consumes the invite in `backend/tests/integration/test_microsoft_exchange.py`
- [X] T036 [P] [US3] Extend failing `GET /v1/me` contract tests that a consumed invite with two roles returns the union of permission codes and landing sections in `backend/tests/contract/test_me.py`
- [X] T037 [P] [US3] Extend failing tests that CombinedLandingPage lists every assigned role after invited sign-in and omits unpermitted sections in `frontend/tests/CombinedLandingPage.test.tsx`

### Implementation for User Story 3

- [X] T038 [US3] Implement `consume_invite` (match `preferred_username` / `email` to an active Invite case-insensitively; copy InviteRoles; set `consumed_at`; set `entry_path=invite`) in `backend/app/core/bootstrap.py`
- [X] T039 [US3] Change `bootstrap_initial_admin` to assign the seeded admin role when combined permissions lack `access_administration` (do not skip solely because other RoleAssignments exist) in `backend/app/core/bootstrap.py`
- [X] T040 [US3] Call `consume_invite` then `bootstrap_initial_admin` after User upsert in `backend/app/api/auth.py`

**Checkpoint**: User Stories 1–3 work independently

---

## Phase 6: User Story 4 - Organization-based entry (Priority: P1)

**Goal**: A valid organizational Microsoft account that was never invited still signs in. A new User with no matching invite gets `entry_path=organization`, sees pending access with no roles, and appears in Settings → Users as waiting for a role. Personal Microsoft accounts remain refused.

**Independent Test**: Sign in with a valid organizational Microsoft account that was never invited. Confirm the person enters, sees pending access when they have no roles, and appears in User Management as waiting for a role. Confirm a personal Microsoft account is still refused.

### Tests for User Story 4

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T041 [P] [US4] Add failing unit tests that a new User with no matching invite gets `entry_path=organization` and stays pending until assigned in `backend/tests/unit/test_organization_entry.py`
- [X] T042 [P] [US4] Extend failing integration tests that an uninvited organizational Microsoft account signs in, is listed as pending, and a personal account is still refused in `backend/tests/integration/test_microsoft_exchange.py`
- [X] T043 [P] [US4] Add failing tests that UsersPage shows an organization-entered person as `pending` / waiting for a role in `frontend/tests/UsersPage.test.tsx`

### Implementation for User Story 4

- [X] T044 [US4] Set `entry_path=organization` when upsert creates a User with no matching invite in `backend/app/core/bootstrap.py`
- [X] T045 [US4] Show `status=pending` and `entryPath=organization` for uninvited signers (pending chip per `ui-spec.md`) in `frontend/src/pages/settings/UsersPage.tsx`

**Checkpoint**: User Stories 1–4 work independently

---

## Phase 7: User Story 5 - Assign and revoke multiple roles (Priority: P1)

**Goal**: Assign adds a role without replacing existing ones; duplicate assign is refused. Revoke removes one role. Last-admin refuses a change that would leave zero signed-in Users with `access_administration`. Unused invites do not count as admins. Invite assign/revoke mirrors user assign/revoke (`POST/DELETE /people/invites/{inviteId}/roles`).

**Independent Test**: Invite a person, assign two different roles, revoke one, attempt a duplicate assign, and confirm the last signed-in person with access-administration cannot have that access removed. Repeat assign and revoke for a person who entered through the organization.

### Tests for User Story 5

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T046 [P] [US5] Add failing contract tests for `POST/DELETE /v1/people/invites/{inviteId}/roles` (200 add-not-replace, 409 `duplicate_assignment`, 403, 404; last-admin does not apply to unused invites) in `backend/tests/contract/test_invite_assign_revoke.py`
- [X] T047 [P] [US5] Extend failing unit tests that last-admin ignores unused invites and user revoke still returns `last_admin_required` in `backend/tests/unit/test_role_assignment.py`
- [X] T048 [P] [US5] Add failing tests that UsersPage assigns/revokes on both `personType` user and invite, refuses duplicates, and shows last-admin for signed-in users in `frontend/tests/UsersPage.test.tsx`

### Implementation for User Story 5

- [X] T049 [US5] Implement `POST /v1/people/invites/{inviteId}/roles` and `DELETE /v1/people/invites/{inviteId}/roles/{roleId}`, and apply Users-only last-admin on user revoke, in `backend/app/api/people.py`
- [X] T050 [US5] Extend UsersPage assign/revoke to unused invites (add, never replace) in `frontend/src/pages/settings/UsersPage.tsx`

**Checkpoint**: User Stories 1–5 work independently

---

## Phase 8: User Story 6 - Create and edit roles (Priority: P1)

**Goal**: Admins create a role (name required, unique; description optional), change name/description, and attach or detach existing permissions. Duplicate attach is refused. Detach updates every assignee on the next request (exact `code` match; no prefix inheritance). Creating permission types is not offered.

**Independent Test**: Create a role, attach two existing permissions, assign it to a person, detach one permission, and confirm the person’s next use follows the remaining attached permissions. Confirm permission types cannot be created.

### Tests for User Story 6

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T051 [P] [US6] Add failing contract tests for `POST /v1/roles`, `PATCH /v1/roles/{roleId}`, and `POST/DELETE /v1/roles/{roleId}/permissions` (201/200, 403, 409 `duplicate_role_name` / `duplicate_permission`, `last_admin_required` on detach) in `backend/tests/contract/test_role_crud.py`
- [X] T052 [P] [US6] Add failing unit tests for unique role name, unique `(role_id, permission_id)`, exact-code combined set after detach (no prefix inheritance), and last-admin on detach in `backend/tests/unit/test_role_crud.py`
- [X] T053 [P] [US6] Add failing tests that RolesPage creates a role, attaches two existing permissions, edits name/description, and detaches one permission in `frontend/tests/RolesPage.test.tsx`
- [X] T054 [P] [US6] Add failing tests that PermissionsPage lists permissions grouped by module and has no create/rename/delete control in `frontend/tests/PermissionsPage.test.tsx`

### Implementation for User Story 6

- [X] T055 [US6] Implement `POST /v1/roles` and `PATCH /v1/roles/{roleId}` (409 `duplicate_role_name`) in `backend/app/api/roles.py`
- [X] T056 [US6] Implement `POST /v1/roles/{roleId}/permissions` and `DELETE /v1/roles/{roleId}/permissions/{permissionId}` (409 `duplicate_permission` / `last_admin_required`) in `backend/app/api/roles.py`
- [X] T057 [US6] Add create, edit name/description, attach, and detach UI to `frontend/src/pages/settings/RolesPage.tsx`
- [X] T058 [US6] Confirm PermissionsPage remains a read-only catalog with no permission-type editor in `frontend/src/pages/settings/PermissionsPage.tsx`

**Checkpoint**: User Stories 1–6 (all P1) work independently

---

## Phase 9: User Story 7 - Delete a role (Priority: P2)

**Goal**: Delete an unused role. Refuse while any User or active Invite still has the role (`role_still_assigned`). Refuse when delete would leave zero signed-in Users with `access_administration`.

**Independent Test**: Create a role, assign it, attempt delete (refused), revoke the assignment, delete the unused role (succeeds). Attempt a delete that would remove the last access-administration path and confirm it is refused.

### Tests for User Story 7

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T059 [P] [US7] Add failing contract tests for `DELETE /v1/roles/{roleId}` (204 unused, 409 `role_still_assigned` for User or active Invite, 409 `last_admin_required`, 403) in `backend/tests/contract/test_role_delete.py`
- [X] T060 [P] [US7] Add failing tests that RolesPage refuses delete while assigned and succeeds after revoke in `frontend/tests/RolesPage.test.tsx`

### Implementation for User Story 7

- [X] T061 [US7] Implement `DELETE /v1/roles/{roleId}` (refuse if RoleAssignment or active InviteRole exists; last-admin) in `backend/app/api/roles.py`
- [X] T062 [US7] Add delete control and `role_still_assigned` / `last_admin_required` messages to `frontend/src/pages/settings/RolesPage.tsx`

**Checkpoint**: User Stories 1–7 work independently

---

## Phase 10: User Story 8 - Cancel invite or remove a person (Priority: P2)

**Goal**: Cancel an unused invite (`cancelled_at`) or remove a signed-in User (assignments gone, refresh family revoked). Neither action blocks later organization-based sign-in. Remove that would leave zero signed-in admins is refused. Cancel is not a last-admin case.

**Independent Test**: Cancel an unused invite and confirm that email may still sign in through the organization and see pending access. Remove a signed-in person (when they are not the last access-administration grant) and confirm they leave the list; if they sign in again they see pending access. Confirm a cancelled or removed email can be invited again.

### Tests for User Story 8

> Write these tests FIRST, ensure they FAIL before implementation

- [X] T063 [P] [US8] Add failing contract tests for `DELETE /v1/people/invites/{inviteId}` (204) and `DELETE /v1/people/{userId}` (204, 409 `last_admin_required`, refresh family revoked) in `backend/tests/contract/test_cancel_remove.py`
- [X] T064 [P] [US8] Add failing integration tests that cancelled or removed emails may sign in through the organization as pending and may be invited again in `backend/tests/integration/test_cancel_remove.py`
- [X] T065 [P] [US8] Add failing tests that UsersPage cancel/remove works, last-admin remove is refused, and cancelled invites leave the list in `frontend/tests/UsersPage.test.tsx`

### Implementation for User Story 8

- [X] T066 [US8] Implement `DELETE /v1/people/invites/{inviteId}` (set `cancelled_at` on unused invites; not a last-admin case) in `backend/app/api/people.py`
- [X] T067 [US8] Implement `DELETE /v1/people/{userId}` (remove User and assignments, revoke refresh family, last-admin) in `backend/app/api/people.py`
- [X] T068 [US8] Add cancel-invite and remove-person controls with last-admin messaging to `frontend/src/pages/settings/UsersPage.tsx`

**Checkpoint**: All user stories are independently functional

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, accessibility, telemetry, icons, and quickstart validation across stories

- [X] T069 [P] Update root `README.md` to state that Settings → Users / Roles / Permissions replaces standalone access administration, describe dual entry (invite optional; organizational Microsoft accounts may sign in without one), and link `specs/003-user-management/quickstart.md`, `specs/003-user-management/contracts/openapi.yaml`, and `specs/003-user-management/ui-spec.md`
- [X] T070 [P] Ensure Settings Users, Roles, and Permissions (invite, assign, create role) are readable on phone/tablet/desktop and keyboard-usable in `frontend/src/pages/settings/*.css` and `frontend/src/layout/AppShell.css`
- [X] T071 Confirm OpenTelemetry traces cover invite, people, role, and permission request paths in `backend/app/core/telemetry.py` and `backend/app/main.py`
- [X] T072 [P] Download Vuesax linear icons listed in `specs/003-user-management/ui-spec.md` into `frontend/src/assets/icons/` (MCP asset URLs expire)
- [X] T073 Confirm there is no dummy, bypass, or local-password sign-in path, no permission-type editor, and `deployment/.env.example` holds placeholders only in `frontend/src/`, `backend/app/`, and `deployment/.env.example`
- [X] T074 Run the validation walkthrough in `specs/003-user-management/quickstart.md` (Settings nav, invite with/without roles, org entry, combined permissions, assign/revoke, role CRUD, delete role, cancel/remove, sensitive fields, responsive, no dummy auth)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - Sequential delivery: US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8
  - After US1, US2 and US6 can proceed in parallel if staffed
- **Polish (Phase 11)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: After Foundational — Settings IA, people/roles/permissions list APIs, replace AccessAdminPage. No dependency on other 003 stories. Retains 002 user assign/revoke on Users page so that path does not regress
- **User Story 2 (P1)**: After US1 Users page — invite create and people-list union. Independently testable with admin session
- **User Story 3 (P1)**: After US2 (invites exist to consume). Combined landing already exists from 002; this story adds consume + bootstrap-after-invite. Independently testable by seeding Invite rows
- **User Story 4 (P1)**: After US3 (`bootstrap.py` consume path). Same file as US3 — do not parallel with US3. Independently testable with an uninvited org token
- **User Story 5 (P1)**: After US1 (user assign UI) and US2 (invites). Adds invite assign/revoke and Users-only last-admin. Independently testable with seeded Invite + User rows
- **User Story 6 (P1)**: After US1 Roles/Permissions pages. Independently testable without invite/org stories
- **User Story 7 (P2)**: After US6 — delete unused roles
- **User Story 8 (P2)**: After US2 — cancel unused invite and remove signed-in person

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models (Phase 2) before invite/role endpoints
- List APIs (US1) before invite create (US2)
- Invite consume (US3) before organization `entry_path` (US4) — same `bootstrap.py`
- Role create/attach (US6) before role delete (US7)
- Story complete before moving to the next priority when staffing is sequential

### Parallel Opportunities

- Phase 1: T002 and T004 can run in parallel with T001/T003
- Phase 2: T005, T006, T007 can run in parallel; T010 and T012 can run in parallel once models exist
- US1 tests T014–T017 in parallel; T018–T020 in parallel; T022/T023 in parallel; T025/T026 in parallel after shell
- US2 tests T028–T030 in parallel
- US3 tests T034–T037 in parallel
- US4 tests T041–T043 in parallel
- US5 tests T046–T048 in parallel
- US6 tests T051–T054 in parallel
- After US1, one developer can take US2 (invites) while another takes US6 (role CRUD)

---

## Parallel Example: User Story 1

```bash
# Launch all US1 tests together:
Task: "Update failing contract tests for GET /people and GET /roles in backend/tests/contract/test_people_roles.py"
Task: "Add failing contract tests for GET /permissions in backend/tests/contract/test_permissions.py"
Task: "Add failing Settings nav tests in frontend/tests/SettingsNav.test.tsx"
Task: "Replace AccessAdminPage tests with UsersPage tests in frontend/tests/UsersPage.test.tsx"

# Launch independent list endpoints together:
Task: "Update GET /people Person payload in backend/app/api/people.py"
Task: "Move GET /roles with permissions to backend/app/api/roles.py"
Task: "Implement GET /permissions in backend/app/api/permissions.py"

# Launch independent frontend chrome together:
Task: "Add Figma tokens in frontend/src/styles/tokens.css"
Task: "Build app shell and sidebar in frontend/src/layout/"
```

---

## Parallel Example: User Story 6

```bash
# Launch all US6 tests together:
Task: "Contract tests for role create/patch/attach/detach in backend/tests/contract/test_role_crud.py"
Task: "Unit tests for duplicate name, duplicate permission, exact-code detach in backend/tests/unit/test_role_crud.py"
Task: "RolesPage create/edit/attach/detach tests in frontend/tests/RolesPage.test.tsx"
Task: "PermissionsPage read-only tests in frontend/tests/PermissionsPage.test.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Admin opens Settings → Users / Roles / Permissions; non-admin cannot; AccessAdminPage is gone; combined landing remains Home
5. Demo gated Settings before invite and role editing

### Incremental Delivery

1. Setup + Foundational → v3 contract, invite models, permission module/action, last-admin helpers
2. User Story 1 → Settings IA (MVP)
3. User Story 2 → Invite by work email
4. User Story 3 → Invite consume + combined permissions after sign-in
5. User Story 4 → Organization-based entry without invite
6. User Story 5 → Assign/revoke for users and unused invites
7. User Story 6 → Create/edit roles and attach/detach existing permissions (end of P1 wave)
8. User Story 7 → Delete unused roles
9. User Story 8 → Cancel invite / remove person
10. Each story adds value without reopening dummy auth or a permission-type editor

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Settings shell + list APIs)
   - After US1: Developer A takes US2/US3/US4 (invite + dual entry); Developer B takes US6/US7 (role CRUD/delete)
   - Developer C: US5 invite assign/revoke and US8 cancel/remove against UsersPage
3. Integrate on `GET /people` Person union + Settings routing, then polish

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to a specific user story for traceability
- Authorization MUST use exact combined permission codes from PostgreSQL on every request, never role display names, `module` strings, prefix matching, or JWT claims
- A module-level permission (`action` null) MUST NOT imply later child codes
- Last-admin counts signed-in Users only; unused invites do not count
- Do not add APIs to create, rename, or delete permission types
- Invite does not send email
- Cancel and remove MUST NOT denylist an organizational account
- Do not store demo cost/margin as money columns
- Secrets and `INITIAL_ADMIN_EMAIL` live in `deployment/.env` only
- Commit after each task or logical group using Conventional Commits
- Stop at any checkpoint to validate the story independently
