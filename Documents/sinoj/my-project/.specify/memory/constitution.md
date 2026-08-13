<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Modified principles: none renamed
Added principles:
  - XVIII. Production Grade
  - XIX. Decoupled System
  - XX. Clean Data Models & Migrations
  - XXI. Native UI, Minimal Dependencies
Added sections: none
Removed sections: none
Follow-up TODOs: none
-->

# Flycatch Finance System Constitution

## Core Principles

### I. Minimal Structure

The Flycatch Finance System MUST ship as two deployable applications only: a
decoupled single monolithic backend and a separate frontend application.
Microservices, extra BFF layers, shared-package sprawl, and unused
dependencies MUST NOT be introduced without a constitution amendment.
Every feature MUST be the smallest complete unit that delivers user value.
Organizational-only modules with no runtime purpose are forbidden.

Rationale: Financial workflows punish accidental complexity; two surfaces keep
ownership, testing, and release cadence explicit.

### II. Contract-First OpenAPI

Every backend capability MUST be specified in OpenAPI before implementation.
Request and response schemas MUST be the source of truth for FastAPI routes,
Pydantic models, and frontend clients. Frontend code MUST consume the
committed contract (generated client or equivalent). Ad-hoc undocumented
endpoints, shadow DTOs, and contract drift are forbidden. Breaking contract
changes MUST increment the API major version and ship a migration note.

Rationale: Contracts, invoicing, and multi-entity reports cannot tolerate
silent payload shape changes.

### III. Test-First (NON-NEGOTIABLE)

TDD is mandatory. Tests MUST be written first, MUST fail, and MUST be reviewed
before production code. The Red-Green-Refactor cycle is strictly enforced.
No feature, bugfix, or contract change MAY merge without automated tests that
prove the acceptance criteria. Skipping tests for "simple" financial
calculations, tax mappings, or entity filters is a compliance failure.

Rationale: Invoice totals, tax series, and entity isolation are irreversible
once posted; tests are the cheapest control.

### IV. Integration Testing

Integration tests MUST cover: OpenAPI contract conformance, entity-context
propagation, RBAC/schema filtering, Proforma-to-Tax Invoice conversion,
multi-series invoicing (GST vs SEZ), ZATCA payload assembly, pagination
contracts, and frontend-backend auth/session boundaries. Shared schemas and
inter-module calls inside the monolith MUST be integration-tested, not only
unit-tested. Contract changes MUST include consumer-side integration coverage.

Rationale: Unit tests cannot prove that global entity state, tax series, and
e-invoicing artifacts remain consistent across the stack.

### V. Observability

Every request MUST emit structured logs with correlation id, actor id, entity
scope (A, B, C, or consolidated), and outcome. Financial mutations MUST emit
an audit event (who, what, which entity, before/after material fields).
Metrics MUST exist for API latency, error rate, invoice conversion, ZATCA
submission, and report generation. Secrets, cost rates, and margins MUST NOT
appear in logs. Tracing MUST span frontend-initiated calls through the
monolith without requiring a mesh.

Rationale: Multi-entity finance is undebuggable without scoped, structured
telemetry.

### VI. Versioning & Breaking Changes

Public APIs, invoice number series, and persisted financial documents MUST
follow semantic versioning and compatibility rules. Additive fields MAY ship
as MINOR. Removals, renames, meaning changes, and tax-behavior changes MUST
ship as MAJOR with a documented migration. Posted invoices, ZATCA UUIDs, ICV
chains, and PIH values MUST remain immutable; corrections MUST use
compensating documents, never silent rewrite.

Rationale: Downstream accounting, GST/SEZ series, and KSA e-invoicing depend
on stable identifiers and hashes.

### VII. Simplicity

YAGNI is non-negotiable. Features MUST NOT introduce speculative workflows,
unused tax regimes, or premature generalization across entities. Duplication
that preserves a clear financial boundary is preferred over a clever shared
abstraction that leaks entity or role data. New libraries MUST be justified
against Principles I and IX before addition.

Rationale: Simple, explicit finance code is auditable; clever code is not.

### VIII. Security by Default

Authentication and authorization MUST be enforced at the server for every
route. The frontend MUST NOT be trusted to hide fields. TLS, secret
management, and least-privilege credentials are mandatory. Input MUST be
validated with Pydantic at the boundary. Injection, mass assignment, and
IDOR across entities MUST be treated as release blockers. Consolidated
("All Entities") access MUST be an explicit permission, not a UI toggle.

Rationale: Cost rates, margins, and tax identifiers are regulated data.

### IX. Performance

The initial frontend bundle MUST stay under 150KB gzipped. Routes and heavy
views MUST be lazy-loaded. Heavy UI or utility libraries are banned,
including MUI, Ant Design, Moment.js, and Lodash. UI MUST use lightweight
headless primitives: Radix UI / Shadcn UI plus Tailwind CSS. List endpoints
MUST paginate server-side with a default page size of 20. Multi-currency
reporting MUST use streaming or async server processing; the client MUST NOT
materialize full report datasets in memory. N+1 queries and unbounded
exports are forbidden.

Rationale: Dense financial screens collapse under heavy kits and unbounded
payloads.

### X. Accessibility & Responsive UI

Layouts MUST work on Mobile (<640px), Tablet (640px–1024px), and Desktop
(>1024px). Dense desktop tables MUST fold into collapsible drawers or stacked
cards on smaller breakpoints; horizontal cramming is forbidden. Interactive
controls MUST be keyboard operable and MUST expose accessible names. Color
MUST NOT be the only status signal (posted, draft, void, ZATCA state).
Touch targets on mobile MUST remain usable without breaking numeric density
on desktop.

Rationale: Finance users work on phones in the field and on wide desks in
accounts; one layout cannot be optional.

### XI. Documentation as Code

Specs, OpenAPI, data-model notes, and operational runbooks MUST live in the
repository and MUST be updated in the same change as the behavior they
describe. Invoice series rules, entity semantics, and ZATCA field mappings
MUST be documented where implemented, not in disconnected slides. README
and Spec Kit artifacts MUST remain sufficient for a new engineer to run,
test, and extend the system.

Rationale: Financial operations knowledge that exists only in chat will
diverge from production.

### XII. Conventional Commits

Every commit MUST follow Conventional Commits (`feat`, `fix`, `docs`, `test`,
`refactor`, `perf`, `chore`, `revert`). Breaking changes MUST use `!` or a
`BREAKING CHANGE` footer. Commit scope SHOULD name the bounded area
(`invoicing`, `contracts`, `entities`, `zatca`, `ui`). History MUST be
reviewable without narrative archaeology.

Rationale: Release notes, audits, and revert decisions depend on parseable
history.

### XIII. Code Review

No change MAY merge without review against this constitution. Reviewers MUST
check entity-context inheritance, RBAC schema filtering, test evidence,
bundle/pagination impact, and financial immutability. Authors MUST NOT
approve their own production changes. Constitution violations are blocking
comments, not nits.

Rationale: Review is the last human control before irreversible postings.

### XIV. Deterministic Error Handling

APIs MUST return typed, contract-defined errors. Partial financial writes
MUST roll back. Invoice conversion, series allocation, and ZATCA submission
MUST be idempotent for retried requests (stable UUID / idempotency key).
User-facing errors MUST be actionable and MUST NOT leak internals, cost
rates, or other entities' data. Timeouts and upstream ZATCA failures MUST
leave documents in an explicit retryable state, never a silent success.

Rationale: Double-posting and lost tax invoices are worse than loud failure.

### XV. Data Integrity & Auditability

Monetary values MUST use decimal types, never binary floating point.
Currency, tax, and quantity arithmetic MUST be server-authoritative.
Posted financial documents are append-only. Every mutation MUST record
actor, timestamp, entity scope, and reason where the domain requires it.
Clock, rounding, and FX conversion rules MUST be explicit and tested.
Re-keying of converted documents is forbidden (see Domain Constraints).

Rationale: Ledgers that cannot be reconstructed cannot be trusted.

### XVI. Least Privilege & Field-Level RBAC

Authorization MUST be role- and entity-scoped. HR roles MUST receive
response payloads that have already stripped financial details, cost rates,
and margins. Filtering MUST occur in FastAPI/Pydantic response schemas at
the server layer. Client-side omission, CSS hiding, or optional JSON fields
left populated are non-compliant. Object-level checks MUST precede
field-level serialization.

Rationale: If sensitive numbers leave the server, RBAC has already failed.

### XVII. Operational Readiness

A change is not done until it can be built, migrated, rolled back, monitored,
and operated. Database migrations MUST be backward-compatible with the
currently deployed monolith. Feature flags MAY gate behavior but MUST NOT
bypass RBAC, entity isolation, or e-invoicing controls. Runbooks MUST exist
for ZATCA submission failure, series exhaustion, and consolidated-report
jobs. Secrets MUST NOT live in the repo.

Rationale: Finance systems fail in operations, not in happy-path demos.

### XVIII. Production Grade

Every mergeable change MUST be production-ready: no debug flags, leftover
`print`/`console.log` noise, hardcoded local URLs, or unfinished
happy-path-only flows. Configuration MUST come from environment, not
committed secrets or machine-specific files. The backend MUST expose health
and readiness checks. Failures MUST degrade explicitly (typed errors,
retries where already required) rather than silent partial success.
Development-only shortcuts (open CORS, disabled auth, `create_all` schema,
mock ZATCA as default) MUST NOT be the production path.

Rationale: Finance software that only works on a laptop is not shippable.

### XIX. Decoupled System

The frontend and backend MUST remain independently buildable, versionable,
and deployable. They MUST communicate only through the committed OpenAPI
contract (Principle II). The frontend MUST NOT import backend modules, share
a database, or read server filesystems. The backend MUST NOT render UI or
depend on frontend packages. A frontend release MUST NOT require a
simultaneous backend release except for a documented breaking contract
change (Principle VI). Cross-cutting concerns (auth, entity scope, errors)
MUST be expressed in the contract, not in shared runtime code.

Rationale: Two apps that cannot ship separately are one coupled system with
extra ceremony.

### XX. Clean Data Models & Migrations

Persisted schema MUST be explicit, named, and reviewed. Every production
schema change MUST be a versioned migration (expand/contract). Migrations
MUST be backward-compatible with the currently deployed monolith
(Principle XVII) and MUST have a documented rollback or expand/contract
sequence. ORM auto-create / auto-alter MUST NOT run against production.
Models MUST use decimal types for money (Principle XV), explicit constraints
(entity scope, uniqueness of invoice series, non-null tax fields), and MUST
NOT leak HR-restricted fields through default serialization. Data-model
notes MUST be updated in the same change (Principle XI).

Rationale: Ledgers and tax series cannot be reconstructed from implicit,
unmigrated schema.

### XXI. Native UI, Minimal Dependencies

UI MUST prefer native HTML elements and CSS (`button`, `input`, `select`,
`table`, `dialog`, semantic landmarks) before custom widgets. The only
allowed UI layer remains Tailwind CSS plus thin headless primitives
(Radix UI / Shadcn UI) already mandated in Principle IX. New frontend
libraries MUST be justified against Principles I, VII, IX, and this
principle; MUI, Ant Design, Moment.js, Lodash, and equivalent kits remain
banned. CSS-in-JS runtimes and extra component kits MUST NOT be added.
Native semantics and accessible names (Principle X) MUST NOT be replaced by
div-only controls.

Rationale: Dense finance UI stays fast and auditable when the DOM stays
native and the dependency graph stays small.

## Technology Stack, Architecture & Domain Constraints

The mandated architecture is a decoupled single monolithic backend plus a
separate frontend application. The backend MUST remain one deployable
service (FastAPI). The frontend MUST remain a separate application that
talks to the backend only through the OpenAPI contract. Frontend and
backend coupling MUST remain contract-only (Principle XIX). Persisted
schema changes MUST ship as versioned expand/contract migrations
(Principle XX).

**Global entity context.** The authenticated session MUST carry a persistent
global entity selection: Entity A, Entity B, Entity C, or All Entities
Consolidated. Downstream forms MUST NOT render an Entity input field; they
MUST inherit entity scope from that global context. Switching entity MUST
refresh dependent lists and drafts. The consolidated view MUST be strictly
read-only: create, update, convert, void, and submit actions MUST be
rejected by the server when scope is consolidated.

**Field-level security.** HR and other non-finance roles MUST never receive
financial details, cost rates, or margins. FastAPI handlers MUST select a
role-appropriate Pydantic response model that omits those fields. Tests MUST
assert absence of stripped keys in the HTTP body, not only in the UI.

**Financial workflows.** Proforma-to-Tax Invoice conversion MUST copy
line items, parties, tax treatments, and amounts without re-keying. Users
MAY adjust only fields the domain explicitly allows post-conversion.
Invoicing MUST support multiple number series, including GST and SEZ, with
server-allocated identifiers. KSA e-invoicing MUST implement ZATCA Phase 2:
UBL 2.1 XML, UUID, ICV, PIH, and QR codes. ZATCA artifacts MUST be generated
and stored server-side; the client MUST NOT assemble cryptographic invoice
chains.

**Frontend stack & performance envelope.** UI MUST prefer native HTML and
CSS, then Tailwind CSS plus thin headless primitives (Radix UI / Shadcn UI)
only (Principle XXI). MUI, Ant Design, Moment.js, Lodash, and equivalent
heavy kits are banned. Initial JS MUST stay under 150KB gzipped with
mandatory route-level lazy-loading. Collections MUST request server-side
pages of 20 by default. Multi-currency reports MUST stream or run
asynchronously.

**Responsive layout.** Breakpoints are Mobile <640px, Tablet 640px–1024px,
and Desktop >1024px. Dense information views MUST fold into collapsible
drawers or stacked cards rather than truncated, unscrolled tables.

## Spec Kit Compliance & Quality Gates

This constitution supersedes conflicting guidance in specs, plans, and
reviews. Spec Kit workflows MUST consult this file at plan time and at
implementation time.

Every feature MUST pass the following gates before `/speckit-plan` Phase 0
research, and MUST be re-checked after Phase 1 design:

1. **Constitution Check** in `plan.md` records pass/fail evidence for
   Principles I–XXI and the Domain Constraints above.
2. **OpenAPI contract** exists or is updated before code; tasks MUST NOT
   implement undocumented routes.
3. **Test plan** includes failing-first unit tests plus integration coverage
   for entity scope, RBAC filtering, and any financial conversion or ZATCA
   behavior touched by the feature.
4. **Entity-context gate:** no new Entity field on downstream forms; consolidated
   path remains read-only on the server.
5. **RBAC gate:** Pydantic response models strip cost rates, margins, and
   financial details for HR roles; tests prove the HTTP body.
6. **Performance gate:** no banned libraries; pagination default 20; new
   frontend routes lazy-loaded; initial bundle budget 150KB gzipped still
   credible; multi-currency work is streamed or async.
7. **Responsive gate:** Mobile / Tablet / Desktop behavior is specified for
   every new dense view (table → drawer or stacked cards).
8. **Immutability gate:** posted invoices and ZATCA identifiers are not
   rewritten in place.
9. **Observability gate:** structured logs and audit events are defined for
   new mutations.
10. **Production-grade gate:** no debug leftovers; health/readiness considered;
    prod path is not a dev shortcut.
11. **Decoupling gate:** no new shared runtime/DB coupling; contract-only
    frontend/backend interaction.
12. **Data-model gate:** schema change has a versioned expand/contract
    migration; no prod auto-schema.
13. **UI-dependency gate:** no new UI kit; native HTML preferred; banned
    libraries still absent.

A failing gate blocks `/speckit-implement` for that feature until the spec
or plan is amended. Exceptions require a documented constitution amendment,
not a reviewer comment.

## Governance

This constitution is the highest-priority project standard. Where a spec,
plan, library default, or oral instruction conflicts with it, this document
wins until it is amended.

**Amendment procedure.** Proposed changes MUST be written as a diff to this
file, MUST include an updated Sync Impact Report, MUST state the semantic
version bump, and MUST describe migration impact on APIs, data, and open
features. Amendments MUST be reviewed and approved before they take effect.
Emergency operational fixes MAY ship under existing principles but MUST NOT
silently redefine them.

**Versioning.** Constitution versions follow semantic versioning:

- MAJOR: backward-incompatible removal or redefinition of a principle or gate.
- MINOR: new principle, new section, or materially expanded guidance.
- PATCH: clarifications, wording, and non-semantic refinements.

The version line below is the source of truth. `LAST_AMENDED_DATE` MUST be
updated on every accepted change. `RATIFICATION_DATE` is the original
adoption date and MUST NOT move.

**Compliance review.** Pull requests, Spec Kit plans, and release reviews
MUST verify constitution compliance explicitly (entity context, RBAC
filtering, performance envelope, financial immutability, production-grade
ship quality, decoupling, data-model migrations, and UI dependency budget).
Unjustified complexity, banned dependencies, and client-side security theater
are automatic rejects. Runtime development MUST follow this file; templates
under `.specify/` are scaffolds only and MUST NOT override ratified rules.

**Version**: 1.1.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-08-13
