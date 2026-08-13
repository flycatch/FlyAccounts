<!--
Sync Impact Report
==================
Version change: 2.0.0 → 3.0.0
Modified principles:
  - XII. Authorized Access → XI. Authorized Access
  - XIII. Operational Readiness → XII. Operational Readiness
  - XIV. Production Grade → XIII. Production Grade
  - XV. Decoupled System → XIV. Decoupled System
  - XVI. Clean Data Models → XV. Clean Data Models
  - XVII. Maintainable UI → XVI. Maintainable UI
Added principles: none
Removed principles:
  - XI. Data Integrity, Accuracy & Auditability
Added sections: none
Removed sections: none
Follow-up TODOs: none
-->

# FlyAccounts Constitution

## Core Principles

### I. Minimal Structure

FlyAccounts MUST be one backend application and one separate frontend
application. Do not add extra services, layers, or unused modules.

Rationale: Two clear parts are easier to own and change than a web of services.

### II. Contract-First OpenAPI

Describe each backend capability in OpenAPI before building it. The frontend
MUST use that contract. Do not add unofficial endpoints.

Rationale: Accounts data is shared across screens; silent contract changes break totals.

### III. Test-First

Write tests before production code. Every change MUST include tests that prove
the acceptance criteria, especially money, tax, and entity rules.

Rationale: Posted amounts are hard to undo. Tests catch mistakes early.

### IV. Integration Testing

Test the backend and frontend together for contracts, entity context, and
shared financial behavior. Unit tests alone are not enough.

Rationale: Entity mix-ups and wrong totals show up across the stack, not in one function.

### V. OpenTelemetry

Use OpenTelemetry for basic traces and useful application telemetry.
Do not add a complex monitoring stack beyond that.

Rationale: When a posting fails, the team MUST be able to follow the request.

### VI. Simplicity

Build only what the current feature needs. Prefer a clear, boring solution
over a clever one.

Rationale: Simple accounts code is easier to check and trust.

### VII. Basic Security

Users MUST be authenticated. Users MUST only access information they are
authorized to see. Sensitive information MUST be protected. Secrets MUST NOT
be committed to the repository.

Rationale: Financial data is confidential. Basic access control is enough here.

### VIII. Performance

Keep the application fast enough for daily accounts work. Load only what is
needed. Do not fetch unbounded lists.

Rationale: Slow or huge screens waste accountant time.

### IX. Accessible, Responsive UI

Screens MUST work on phone, tablet, and desktop. Dense tables MUST fold into
simpler stacked views on small screens. Controls MUST be usable with a keyboard.

Rationale: Staff work in the office and on the move.

### X. Conventional Commits

Use Conventional Commits (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`).

Rationale: Clear history makes releases and audits easier.

### XI. Authorized Access

Show each user only the data their role allows. Hide cost, margin, and other
sensitive financial fields from roles that must not see them. Do this on the
server, not only on the screen.

Rationale: If a number left the server, access control already failed.

### XII. Operational Readiness

A change is done only when it can be configured, started, and run safely.
Keep secrets out of the repo. Prefer environment configuration.

Rationale: Accounts software must work in a real environment, not only on a laptop.

### XIII. Production Grade

Ship finished, honest behavior. Do not leave debug shortcuts, dummy auth, or
hidden failures in the path people use.

Rationale: Partial success in finance is worse than a clear error.

### XIV. Decoupled System

Frontend and backend MUST build and run on their own. They MUST talk only
through the published contract. Do not share a database or source folders.

Rationale: The two apps should be able to change on different days.

### XV. Clean Data Models

Stored data MUST have a clear, versioned structure. Change the data store
with migrations, not automatic rewrite on startup. Money fields MUST stay
decimal.

Rationale: Accounts history lives in the data model.

### XVI. Maintainable UI

Prefer ordinary page controls and a small UI toolkit. Do not add large extra
UI libraries without a clear need.

Rationale: A small frontend is easier to keep correct and fast.

## Project Context

FlyAccounts is a financial accounts application. It uses one backend and one
frontend. Later features (contracts, invoicing, reporting) MUST follow this
constitution.

**Entity context.** Work happens in Entity A, Entity B, Entity C, or All
Entities Consolidated. Forms MUST inherit the current entity and MUST NOT
ask for it again. Consolidated view is read-only.

**Financial records.** Posted documents stay as they were written. Corrections
use a new document, not a silent edit.

**Validation.** Inputs and financial calculations MUST be checked before they
are saved or shown as final.

## Spec Kit Compliance & Quality Gates

This constitution is the project standard. Specs and plans MUST follow it.

Before planning and again after design, each feature MUST show that it:

1. Follows the principles above.
2. Has or updates the OpenAPI contract before code.
3. Includes tests for money, entity context, and access rules it touches.
4. Keeps consolidated view read-only and does not add an Entity field on forms.
5. Keeps secrets out of the repository.
6. Uses OpenTelemetry for basic traces when it adds new request paths.

A failing gate blocks implementation until the spec or plan is fixed, or this
constitution is amended.

## Governance

This constitution wins when it conflicts with a spec, plan, or informal
instruction, until it is amended.

**Amendment procedure.** Change this file, update the Sync Impact Report,
state the version bump, and get review before it applies.

**Versioning.**

- MAJOR: a principle is removed or given a new meaning.
- MINOR: a principle or section is added or clearly expanded.
- PATCH: wording and small clarifications only.

The version line below is the source of truth. Last Amended changes with
every accepted edit. Ratified stays the original adoption date.

**Compliance review.** Reviews MUST check simplicity, tests, basic security,
and the posted-record and validation rules in Project Context. Extra
complexity needs a clear reason.

**Version**: 3.0.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
