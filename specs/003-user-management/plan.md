# Implementation Plan: Settings User Management

**Branch**: `003-user-management` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-user-management/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

FlyAccounts replaces the standalone access-administration home with **Settings** in the sidebar: **Users**, **Roles**, and **Permissions**. People may be invited by organizational work email (zero or more roles) or may sign in with a valid organizational Microsoft account without an invite. Combined permissions remain the union of **exact permission codes** on assigned roles, loaded from PostgreSQL on every request. Permissions are module-level now (`module` plus nullable `action`); later modules add granular codes on the same table. Admins create, edit, and delete roles and attach or detach existing permissions; creating permission types is out of scope. [contracts/openapi.yaml](./contracts/openapi.yaml) is the **single source of truth** for this feature’s API (version 3.0.0). The backend MUST implement that document; the frontend MUST generate its client from it. Visual chrome follows [ui-spec.md](./ui-spec.md) (Figma Billing And Invoice tokens); invoice screens are not ported.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript + React 18 (frontend)

**Primary Dependencies**: FastAPI, Uvicorn, SQLAlchemy 2, Alembic, psycopg, boto3, OpenTelemetry FastAPI instrumentation, PyJWT + cryptography, OpenAPI contract tests against the committed YAML; Vite, React, `@azure/msal-browser`, ordinary CSS with variables from [ui-spec.md](./ui-spec.md) (no large UI kit, no Tailwind), `openapi-typescript` + `openapi-fetch`, Plus Jakarta Sans and Work Sans via Google Fonts

**Storage**: PostgreSQL 16 (Alembic revision `0003_user_management` after `0002_auth_rbac`: `invites`, `invite_roles`, `users.entry_path`, `permissions.module`, `permissions.action`). S3-compatible object storage unchanged

**Testing**: pytest + httpx (backend contract tests MUST assert live responses match `contracts/openapi.yaml`); Vitest + Testing Library; compose-backed integration for invite consume on Microsoft exchange, organization-based pending access, role CRUD, last-admin, cancel/remove

**Target Platform**: Linux local/dev; browsers on phone, tablet, and desktop widths

**Project Type**: Decoupled web app (frontend + backend)

**Performance Goals**: Supervised invite from Settings → Users within 3 minutes (SC-001); sign-in to pending or combined landing within 60 seconds (SC-002)

**Constraints**: Secrets and `INITIAL_ADMIN_EMAIL` only via environment. No dummy or local-password sign-in. Access JWT MUST NOT embed roles. Invite is an in-app record (no outbound email). Personal Microsoft accounts remain refused. Permissions are module-level named capabilities on one table (`module` plus nullable `action`); no permission-type editor; authorization is exact `code` match with no prefix inheritance.

**Scale/Scope**: Settings (Users, Roles, Permissions), invite + organization entry, role CRUD, attach/detach existing permissions, cancel unused invite, remove signed-in person. No legal-entity switching, no finance modules beyond standing field policy. Invitation email is sent via backend SMTP when configured.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-design: PASS**

| Gate | Result |
|------|--------|
| I. Minimal Structure | Pass — one backend, one frontend. No extra identity or admin service. |
| II. Contract-First OpenAPI | Pass — `contracts/openapi.yaml` (this feature, v3.0.0) is the single source of truth. |
| III. Test-First | Pass — contract, unit, and integration tests planned before production code, including invite, last-admin, and access-rule cases. |
| IV. Integration Testing | Pass — frontend and backend checked together against the Settings and dual-entry contract. |
| V. OpenTelemetry | Pass — basic traces on new invite, people, role, and permission request paths. |
| VI. Simplicity | Pass — Invite table + existing User/Role/Permission; no permission editor; no extra IdP. |
| VII. Basic Security | Pass — Microsoft sign-in unchanged; Settings actions require `access_administration` on the server. |
| VIII. Performance | Pass — people list is organization-scale; pagination deferred until lists are unbounded in practice. |
| IX. Accessible, Responsive UI | Pass — Settings, Users, Roles, Permissions readable on phone, tablet, and desktop; keyboard-usable; sidebar collapses on small screens ([ui-spec.md](./ui-spec.md)). |
| X. Conventional Commits | Pass — later implementation commits use Conventional Commits. |
| XI. Authorized Access | Pass — combined permissions enforced on the server; sensitive fields omitted when the permission is absent; Settings hidden and refused without `access_administration`. |
| XII. Operational Readiness | Pass — no new secrets beyond 002 env keys. |
| XIII. Production Grade | Pass — no dummy auth; last-admin revoke/delete/remove refused; cancel/remove do not denylist. |
| XIV. Decoupled System | Pass — separate trees; talk only through this feature’s published YAML. |
| XV. Clean Data Models | Pass — Alembic `0003_user_management`; no auto-rewrite; no money columns; `permissions.module` / `permissions.action` are additive columns, not a second store. |
| XVI. Maintainable UI | Pass — ordinary CSS variables from Figma tokens; no Tailwind; no large UI kit. |

Quality gates from constitution:

1. Follows the principles above — **Pass**.
2. OpenAPI contract before code — **Pass** (`contracts/openapi.yaml` is SSOT).
3. Tests for money, entity context, and access rules it touches — **Pass** (access-rule tests; standing field policy unchanged). Entity context N/A.
4. Consolidated view read-only; no Entity field on forms — **N/A** (no entity switching).
5. Secrets out of the repository — **Pass**.
6. OpenTelemetry on new request paths — **Pass**.

**Post-design re-evaluation: PASS**

Phase 1 artifacts (`research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`, `ui-spec.md`) do not add extra applications, unofficial endpoints, a permission-type editor, committed secrets, or a monitoring stack. Dual entry is encoded: unused invites are a separate table; organizational Microsoft sign-in still upserts a User. Settings is three sidebar sections, not a second product. Role CRUD attaches existing permissions only. Permissions are module-level rows (`module`, nullable `action`) with exact-code checks and no prefix inheritance. Last-admin counts signed-in Users only. CORS gains `PATCH`. Figma is chrome/tokens only. No new constitution violations. Implementation may proceed to `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/003-user-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── ui-spec.md           # Phase 1 extra: Figma tokens + Settings IA
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
README.md

backend/
  Dockerfile
  app/
    main.py              # CORS GET, POST, PATCH, DELETE; OpenAPI fallback this feature YAML; version 3.0.0
    api/
      status.py
      auth.py            # microsoft exchange consumes matching invite, then initial-admin bootstrap
      people.py          # people union, invites, assign/revoke user and invite roles, remove person
      roles.py           # list/create/patch/delete roles; attach/detach permissions
      permissions.py     # GET /permissions read-only
    core/
      config.py
      security.py
      bootstrap.py       # consume invite; admin bootstrap if still missing access_administration
      permissions.py     # last-admin counts signed-in Users only
      telemetry.py
    models/              # User (+ entry_path), Invite, InviteRole, existing RBAC
    db/session.py
    storage/s3.py
  alembic/
    versions/
      0001_baseline.py
      0002_auth_rbac.py
      0003_user_management.py
  tests/
    contract/
    integration/
    unit/

frontend/
  Dockerfile
  src/
    auth/
    pages/
      SignInPage.tsx
      PendingAccessPage.tsx
      CombinedLandingPage.tsx
      StatusPage.tsx
      settings/          # Users, Roles, Permissions pages; replace AccessAdminPage
    layout/              # App shell + sidebar per ui-spec.md
    api/client.ts
    api/schema.d.ts      # generated from this feature's contracts/openapi.yaml
  tests/

deployment/
  docker-compose.yml
  .env.example
```

**Structure Decision**: Same decoupled layout as 001/002. This feature adds invite/role-management modules inside those trees and replaces `AccessAdminPage` with Settings. It does not add a third application.

**Contract consumption**: [contracts/openapi.yaml](./contracts/openapi.yaml) is the API for this stage (v3.0.0). At implementation, copy it to `backend/contracts/openapi.yaml` and point `frontend` `generate:api` at this file instead of `specs/002-microsoft-auth-rbac/contracts/openapi.yaml`. Do not treat FastAPI's auto-generated `/openapi.json` as the source of truth.

### Root README (updated at implementation)

Root `README.md` MUST be updated to:

- State that Settings → Users / Roles / Permissions replaces standalone access administration
- State dual entry: invite is optional; organizational Microsoft accounts may sign in without an invite
- Link to [quickstart.md](./quickstart.md), [contracts/openapi.yaml](./contracts/openapi.yaml), and [ui-spec.md](./ui-spec.md)

## Complexity Tracking

> No constitution violations requiring justification.

A separate `Invite` table (rather than nullable `User.microsoft_oid`) keeps unused pre-provision rows out of the identity unique key. That is a second table for a second spec entity, not a seventh application.

## Session and authorization rules

- Microsoft ID token rules from 002 are unchanged (tenant, SPA client, personal accounts refused).
- After a successful exchange: upsert User by `microsoft_oid`; if email matches an active Invite (case-insensitive), copy InviteRoles to RoleAssignments, set `entry_path=invite`, consume the invite; otherwise if this is a new User, set `entry_path=organization`.
- Then, if combined permissions still lack `access_administration` and work email matches `INITIAL_ADMIN_EMAIL`, assign the seeded admin role (do not skip because an invite already attached other roles).
- Access JWT `sub` is the internal user UUID. Claims MUST NOT include roles or permissions.
- Every protected request loads combined permissions from the database (exact `code` match; a module-level grant does not imply later child codes).
- `GET /v1/status` still requires a valid access JWT and at least one role.
- All Settings endpoints require `access_administration`. Missing permission is 403, not only hidden nav.
- Last-admin: refuse revoke, detach, delete role, or remove person when the change would leave zero **signed-in Users** whose combined permissions include `access_administration`. Unused invites do not count.
- Cancel unused invite and remove signed-in person do not prevent later organization-based sign-in.
