# Implementation Plan: Microsoft Authentication with RBAC

**Branch**: `002-microsoft-auth-rbac` | **Date**: 2026-08-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-microsoft-auth-rbac/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

FlyAccounts requires an organizational Microsoft work or school account before anyone can use the application. Microsoft proves identity only. After a valid Microsoft ID token, the backend issues a short-lived access JWT and an opaque refresh token; the frontend stores both in `localStorage` and sends the access JWT as a Bearer token. Combined permissions come from PostgreSQL on every request (not from JWT claims). A designated initial organizational Microsoft email in environment configuration receives a seeded role that already includes `access_administration`. People with that permission assign or revoke existing roles; a signed-in person with no roles sees pending access; a person with one or more roles sees one combined landing. `GET /v1/status` is no longer public. [contracts/openapi.yaml](./contracts/openapi.yaml) is the **single source of truth** for this feature’s API (version 2.0.0). The backend MUST implement that document; the frontend MUST generate its client from it.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript + React 18 (frontend)

**Primary Dependencies**: FastAPI, Uvicorn, SQLAlchemy 2, Alembic, psycopg, boto3, OpenTelemetry FastAPI instrumentation, PyJWT + cryptography (issue access JWTs; validate Microsoft ID tokens via JWKS), OpenAPI contract tests against the committed YAML; Vite, React, `@azure/msal-browser`, ordinary CSS (no large UI kit), `openapi-typescript` + `openapi-fetch`

**Storage**: PostgreSQL 16 (Alembic-managed tables for users, permissions, roles, assignments, refresh tokens). S3-compatible object storage unchanged from foundation (reachability only)

**Testing**: pytest + httpx (backend contract tests MUST assert live responses match `contracts/openapi.yaml`); Vitest + Testing Library (frontend uses the generated client and a localStorage test double); one compose-backed integration path for Microsoft-token exchange (mocked JWKS in tests), refresh rotation, and access-administration rules

**Target Platform**: Linux local/dev; browsers on phone, tablet, and desktop widths

**Project Type**: Decoupled web app (frontend + backend)

**Performance Goals**: Supervised sign-in reaches pending access or the combined landing within 60 seconds (SC-001)

**Constraints**: Secrets and `INITIAL_ADMIN_EMAIL` only via environment (`deployment/.env` gitignored; `deployment/.env.example` committed with placeholders). No dummy, bypass, or local-password sign-in. Access JWT MUST NOT embed roles. Refresh tokens hashed at rest, rotated on use, family revoked on reuse. Tokens in `localStorage` with short access TTL.

**Scale/Scope**: Sign-in, pending access, combined landing, access administration, authenticated status. Four seeded roles as data. No role/permission editor, no legal-entity switching, no finance modules beyond landing field policy.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-design: PASS**

| Gate | Result |
|------|--------|
| I. Minimal Structure | Pass — one backend, one frontend. No extra auth service. |
| II. Contract-First OpenAPI | Pass — `contracts/openapi.yaml` (this feature, v2.0.0) is the single source of truth. Backend implements it; frontend generates from it. FastAPI auto-schema is not the contract. |
| III. Test-First | Pass — contract, unit, and integration tests planned before production code, including access-rule cases. |
| IV. Integration Testing | Pass — frontend and backend checked together against the auth and landing contract. |
| V. OpenTelemetry | Pass — basic traces on new auth, me, people, and status request paths. |
| VI. Simplicity | Pass — Microsoft identity + backend JWT session + assignment of existing roles. No role editor, no extra IdP. |
| VII. Basic Security | Pass — real Microsoft sign-in; JWT session; secrets and initial admin identity in env; short-lived access tokens and refresh rotation. Closes the foundation public-page exception. |
| VIII. Performance | Pass — sign-in and landing within SC-001; no unbounded people lists without pagination later if needed (this feature’s people list is signed-in users only). |
| IX. Accessible, Responsive UI | Pass — sign-in, pending access, combined landing, and access administration readable on phone, tablet, and desktop; keyboard-usable. |
| X. Conventional Commits | Pass — later implementation commits use Conventional Commits. |
| XI. Authorized Access | Pass — combined permissions enforced on the server; sensitive financial fields omitted from the payload when the permission is absent. Closes the foundation exception. |
| XII. Operational Readiness | Pass — Entra, JWT signing key, and initial admin email via `deployment/` env. |
| XIII. Production Grade | Pass — no dummy auth; cancelled/rejected Microsoft sign-in stays unsigned; last-admin revoke refused. |
| XIV. Decoupled System | Pass — separate trees; talk only through this feature’s published YAML. |
| XV. Clean Data Models | Pass — Alembic revision after `0001_baseline`; no auto-rewrite; no money columns stored (landing demo fields are derived, not posted records). |
| XVI. Maintainable UI | Pass — React with ordinary page controls; MSAL browser for the Microsoft prompt only; no large UI kit. |

Quality gates from constitution:

1. Follows the principles above — **Pass**.
2. OpenAPI contract before code — **Pass** (`contracts/openapi.yaml` is SSOT).
3. Tests for money, entity context, and access rules it touches — **Pass** (access-rule tests; standing field policy on the landing). Entity context N/A.
4. Consolidated view read-only; no Entity field on forms — **N/A** (no entity switching in this feature).
5. Secrets out of the repository — **Pass**.
6. OpenTelemetry on new request paths — **Pass**.

**Post-design re-evaluation: PASS**

Phase 1 artifacts (`research.md`, `data-model.md`, `contracts/openapi.yaml`, `quickstart.md`) do not add extra applications, unofficial endpoints, a role/permission editor, committed secrets, or a monitoring stack. `GET /v1/status` moves behind Bearer auth and at-least-one-role, matching FR-015. Access JWT identifies the user only; combined permissions are loaded from PostgreSQL per request (FR-020). Initial admin is `INITIAL_ADMIN_EMAIL` in env. Refresh tokens are hashed, rotated, and family-revoked on reuse. Seeded roles exist as data; assignment APIs do not create roles. Sensitive fields are absent from `GET /me` unless `view_sensitive_financial_fields` is in the combined set. Foundation exceptions for VII and XI are closed. No new constitution violations. Implementation may proceed to `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/002-microsoft-auth-rbac/
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
    api/
      status.py          # GET /v1/status now requires auth + at least one role
      auth.py            # microsoft, refresh, logout, me
      people.py          # people list, role assign/revoke
    core/
      config.py          # Entra, JWT, INITIAL_ADMIN_EMAIL
      security.py        # issue/verify access JWT; hash/rotate refresh
      telemetry.py
    models/              # User, Permission, Role, RoleAssignment, RefreshToken
    db/session.py
    storage/s3.py
  alembic/
    versions/
      0001_baseline.py
      0002_auth_rbac.py  # tables + seed permissions/roles
  tests/
    contract/
    integration/
    unit/

frontend/
  Dockerfile
  src/
    auth/                # MSAL config, localStorage token helpers, refresh-on-401
    pages/
      SignInPage.tsx
      PendingAccessPage.tsx
      CombinedLandingPage.tsx
      AccessAdminPage.tsx
      StatusPage.tsx     # shown on or beside the combined landing; not public
    api/client.ts        # openapi-fetch + Authorization header from localStorage
    api/schema.d.ts      # generated from this feature's contracts/openapi.yaml
  tests/

deployment/
  docker-compose.yml     # pass new backend env vars
  .env.example           # placeholders for Entra, JWT, INITIAL_ADMIN_EMAIL
```

**Structure Decision**: Same decoupled layout as foundation. `backend/` and `frontend/` remain separate apps. `deployment/` remains the only Compose/env location. This feature adds auth/RBAC modules inside those trees; it does not add a third application.

**Contract consumption**: [contracts/openapi.yaml](./contracts/openapi.yaml) is the API for this stage (v2.0.0). At implementation, copy it to `backend/contracts/openapi.yaml` and point `frontend` `generate:api` at this file instead of `specs/001-app-foundation/contracts/openapi.yaml`. Do not treat FastAPI's auto-generated `/openapi.json` as the source of truth. Do not hand-write parallel token or landing types.

### Root README (updated at implementation)

Root `README.md` MUST be updated to:

- State that the app requires Microsoft sign-in (foundation public confirmation is gone)
- List new env keys: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `INITIAL_ADMIN_EMAIL`, `JWT_SIGNING_KEY`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID`
- Link to [quickstart.md](./quickstart.md) and [contracts/openapi.yaml](./contracts/openapi.yaml)

## Complexity Tracking

> No constitution violations requiring justification.

Token storage in `localStorage` is an explicit product/session choice (see [research.md](./research.md)), not a seventh application or a dummy-auth path. Short access TTL, refresh rotation, and reuse detection keep it within VII Basic Security.

## Session and authorization rules (spec FR-014 / FR-020)

- Microsoft ID token is accepted only for the configured tenant and SPA client id. Personal or unknown-directory tokens MUST NOT create a User and MUST NOT issue JWTs.
- Access JWT `sub` is the internal user UUID. Claims MUST NOT include roles or permissions.
- Every protected request loads RoleAssignments and unions Permission.codes from the database.
- Role changes take effect on the next request. A stolen or stale access JWT that still validates still cannot see content the current combined set does not allow, because the payload is built from the database.
- `GET /v1/status` requires a valid access JWT and at least one role (401 unsigned, 403 pending access).
- `GET /v1/me` is allowed for any signed-in person. Pending access returns `accessState: pending` and no sensitive fields.
- Assign/revoke requires `access_administration` in the caller’s combined permissions. Duplicate assignment is 409. Revoke that would leave zero people with `access_administration` is 409.
- Sign-out revokes the current refresh token family member and clears `localStorage`.
