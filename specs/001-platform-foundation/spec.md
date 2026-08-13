# Feature Specification: Application Initialization Baseline (Phase 1)

**Feature Branch**: `001-platform-foundation`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Build the foundational application initialization baseline for a Finance platform (Phase 1). The platform is a monolithic backend application with a strictly separate frontend application, communicating only through versioned REST API contracts, optimized for minimal footprint, high runtime performance, financial data integrity, and consistent reporting behavior. This foundation serves as the baseline for all subsequent Finance feature specifications (Contract Management, Resource Allocation, Proforma Invoicing, Tax Invoicing, ZATCA Phase 2 E-Invoicing, Accounts Receivable, Accounts Payable, Financial Reporting, and Financial Consolidation). Scope Coverage: Application Structure & Module Boundaries; REST API Contract Conventions; Startup & Runtime Configuration; Foundational Financial Conventions including legal-entity context via X-Entity-Context header, read-only consolidated scope, Indian Financial Year (April 1 – March 31, Asia/Kolkata), INR base currency and multi-currency decimal/rounding standards; Cross-Cutting Standards including performance, logging, auditability, error handling, field-level data redaction capabilities for non-finance roles, traceability, and security-conscious data handling. Explicitly Out of Scope: Authentication and Authorization, Contract Management, Resource Allocation, Proforma Invoicing & Tax Invoicing, ZATCA Phase 2 E-Invoicing, Accounts Receivable & Accounts Payable, Financial Reporting & Financial Consolidation, and all other business/feature modules. Primary Deliverable: Establish only the reusable application, API, runtime, financial-data, entity-context (X-Entity-Context), and cross-cutting standards required to support future specifications."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring the platform up and know it is ready (Priority: P1)

An operator supplies environment configuration (including secrets that never live in source), applies the baseline stored-structure initialization, and starts the backend service and the web application as two independently runnable parts. At startup the platform loads financial context configuration: known legal entities, the fiscal-year calendar, the base reporting currency, the default timezone, and rounding rules. The operator can tell whether a process is merely live versus actually ready (configuration present, data store reachable, baseline structure applied, financial context loaded). Later finance modules must not be treated as startable until this ready signal is true.

**Why this priority**: Every later finance specification assumes a bootable, inspectable runtime. A laptop-only happy path is not a foundation.

**Independent Test**: From a clean environment, supply configuration, apply baseline structure, start both parts, and confirm a live signal versus a ready signal. Remove a required setting or block the data store and confirm the system reports not ready rather than silent success. Confirm financial context (entities, fiscal calendar, base currency, timezone) is loaded when ready.

**Acceptance Scenarios**:

1. **Given** valid environment configuration and a reachable data store, **When** the operator applies baseline structure and starts both parts, **Then** the backend service and the web application start independently and the ready signal reports success.
2. **Given** the processes are running, **When** an operator asks whether the system is live, **Then** they receive a clear live indication even if dependencies are still settling.
3. **Given** required configuration is missing, the data store is unreachable, baseline structure is not applied, or financial context failed to load, **When** an operator asks whether the system is ready, **Then** the system reports not ready with an actionable reason and does not present itself as ready.
4. **Given** secrets and environment-specific values, **When** the system is configured, **Then** those values come from the environment and are not stored in project source.

---

### User Story 2 - Keep shared platform separate from future finance modules (Priority: P1)

A future feature team must be able to add Contract Management, Resource Allocation, Proforma or Tax Invoicing, ZATCA Phase 2, Accounts Receivable, Accounts Payable, Financial Reporting, or Financial Consolidation without rewriting shared startup, contract conventions, entity context, or financial-data rules. This baseline establishes a shared platform area and reserved space for those modules. Nothing in this baseline implements them. Sample or probe capabilities used to prove conventions live in the shared platform, not inside a pretended contract, invoice, or consolidation module.

**Why this priority**: If the foundation and the first business module are tangled, every later specification will fork the platform.

**Independent Test**: Inspect the running baseline and its published contract. Confirm shared startup, health, contract conventions, entity-context rules, and financial-data rules are present. Confirm there is no contract, resource-allocation, proforma, tax-invoice, ZATCA, receivable, payable, reporting, or consolidation capability. Confirm a documented place exists for those modules to attach later.

**Acceptance Scenarios**:

1. **Given** the baseline is running, **When** an operator or reviewer lists offered capabilities, **Then** they see only shared platform capabilities (startup, health/readiness, contract probes, financial-convention probes, visibility-rule probes) and not finance business modules.
2. **Given** the published structure of the product, **When** a reviewer looks for module boundaries, **Then** shared platform infrastructure is distinct from reserved finance-module space.
3. **Given** a later specification for a listed finance module, **When** that module is added, **Then** it can follow this baseline's contract, startup, entity-context, redaction, and financial-data rules without changing those shared rules.

---

### User Story 3 - Speak one versioned contract language (Priority: P1)

Anyone building a later finance screen or service uses one published, versioned contract. The web application talks to the backend only through that contract. Resource names follow a consistent financial naming style. Success answers use one envelope. Validation and other failures use one typed, user-safe error format. Money is represented the same way everywhere (original amount, currency, and rounding). Lists are paged. The contract exists before a capability is offered.

**Why this priority**: Finance modules will multiply. Private response shapes and informal money fields will make totals and support untrustworthy.

**Independent Test**: Exercise a successful platform probe, a validation failure, a missing-resource failure, and a missing-entity-context failure. Confirm one success envelope, one error format, published versioning, consistent money fields, and default paging of 20 items. Confirm the web application does not bypass the published contract.

**Acceptance Scenarios**:

1. **Given** the published contract, **When** a client calls a successful platform list probe without specifying page size, **Then** it receives at most 20 items plus enough paging information to request the next page, inside the standard success envelope.
2. **Given** an invalid request, **When** the platform rejects it, **Then** the client receives a typed, actionable error in the standard format and does not receive stack traces, secrets, or other legal entities' data.
3. **Given** a request that omits or misstates required legal-entity context, **When** the platform responds, **Then** the outcome is a standard closed failure and does not invent a default entity.
4. **Given** any baseline capability, **When** the web application uses it, **Then** it does so only through the published versioned contract, and money fields match the standard amount-and-currency representation.

---

### User Story 4 - Apply one legal-entity, period, and calendar rule (Priority: P2)

Every later finance record will belong to a legal entity and an accounting period. This baseline defines those rules so modules do not invent their own. Legal-entity context is a first-class platform convention: every business-bound request declares it using the published context token named `X-Entity-Context` (Entity A, Entity B, Entity C, or All Entities Consolidated). Records are attributable to exactly one legal entity. Consolidated scope is read-only for writes. Accounting dates resolve to exactly one fiscal year and one accounting period. The fiscal year is the Indian Financial Year, 1 April through 31 March, in the Asia/Kolkata timezone.

**Why this priority**: Contracts, invoices, and consolidation will disagree if entity, period, and calendar are optional or local.

**Independent Test**: Load financial context at startup. Resolve dates on both sides of 31 March / 1 April. Submit a platform probe with a valid `X-Entity-Context`, with the token missing, and with an unknown value. Confirm period resolution has no gaps or overlaps and that consolidated scope is read-only for writes.

**Acceptance Scenarios**:

1. **Given** financial context is loaded, **When** a platform probe is issued with `X-Entity-Context` set to a known legal entity, **Then** the response is attributable to that legal entity only.
2. **Given** a business-bound platform probe, **When** `X-Entity-Context` is missing, unknown, or malformed, **Then** the platform fails closed and does not substitute another entity or consolidated scope.
3. **Given** the date 31 March 2027 in Asia/Kolkata, **When** the platform resolves fiscal year and accounting period, **Then** the fiscal year is 1 April 2026 through 31 March 2027 and the date falls in exactly one period.
4. **Given** the date 1 April 2027 in Asia/Kolkata, **When** the platform resolves fiscal year, **Then** the fiscal year is 1 April 2027 through 31 March 2028.
5. **Given** `X-Entity-Context` is All Entities Consolidated, **When** a write is evaluated against this baseline's rules, **Then** create, change, void, and submit are refused. This baseline does not implement those finance-module writes.

---

### User Story 5 - Omit cost and margin for non-finance visibility (Priority: P2)

Later modules will serve both finance and non-finance (HR) audiences. This baseline establishes a reusable server-side visibility rule: when a request is evaluated as the non-finance visibility class, cost rates, margins, and equivalent financial details are omitted from what is delivered. A finance visibility class still receives those fields. The rule is proven on a sample/probe record. Sign-in and role assignment are not part of this baseline; the probe declares a visibility class so a later identity specification can bind a real person to it. Hiding values only on a screen is not enough.

**Why this priority**: If redaction is left to each business module, cost and margin will leak. The constitution requires server-side omission before those modules exist.

**Independent Test**: Using the same sample record that includes cost and margin, retrieve it once as the finance visibility class and once as the non-finance (HR) visibility class. Confirm the non-finance delivery omits those fields entirely and the finance delivery includes them. Confirm the omitted values are not present in what was delivered, not merely hidden on screen.

**Acceptance Scenarios**:

1. **Given** a sample record that contains cost rate and margin, **When** it is retrieved as the finance visibility class, **Then** cost rate and margin are present.
2. **Given** the same record, **When** it is retrieved as the non-finance (HR) visibility class, **Then** cost rate, margin, and equivalent financial details are absent from what is delivered — not blanked, not zeroed, not merely hidden on screen.
3. **Given** the non-finance visibility class, **When** list, detail, or another baseline retrieval is used for that record, **Then** none of those paths expose the restricted fields.
4. **Given** a later authentication specification, **When** it assigns a real person to a visibility class, **Then** it can reuse this rule without each finance module inventing its own redaction.

---

### User Story 6 - Treat money, rounding, and time the same way everywhere (Priority: P2)

Anyone recording or displaying money uses decimal amounts, an explicit currency, and published rounding. Original currency is never discarded. When a reporting conversion to the base currency (INR) is required, it uses a rate bound to the Indian Financial Year period. Timestamps are stored and shown against Asia/Kolkata. Later modules must not use binary floating point or implicit local time.

**Why this priority**: A one-cent disagreement at the foundation becomes an unreconcilable total later.

**Independent Test**: Store a sample amount in a non-INR currency, request FY-period INR conversion when a rate exists, request conversion when no rate exists, and resolve a timestamp at a fiscal-year boundary. Confirm original currency remains, money is not binary floating point, and timezone is Asia/Kolkata.

**Acceptance Scenarios**:

1. **Given** a sample monetary amount in a non-INR currency, **When** it is stored through a platform probe, **Then** original currency and original amount are preserved as decimals with the published rounding.
2. **Given** that amount and a defined FY-period conversion rate to INR, **When** reporting conversion is requested, **Then** the platform returns an INR reporting amount for that fiscal year without discarding the original amount.
3. **Given** no FY-period rate, **When** conversion is requested, **Then** the platform returns a typed error and does not guess a rate.
4. **Given** Asia/Kolkata, **When** a timestamp is recorded at the 31 March / 1 April boundary, **Then** fiscal-year resolution and the displayed date agree with that timezone.

---

### User Story 7 - Leave a trace without leaking sensitive data (Priority: P3)

When a platform probe mutates sample data or a request is slow or fails, an operator can reconstruct what happened: correlation identifier, time, legal-entity context from `X-Entity-Context`, outcome, duration, and—for mutations—material before-and-after fields. An actor slot exists so a later identity specification can fill it; this baseline does not authenticate users. General logs never contain secrets or raw sensitive financial fields. Errors stay typed and consistent.

**Why this priority**: Future audit and incident response will fail if the foundation logs noise or omits entity and correlation.

**Independent Test**: Run a sample mutation probe and a failing probe. Confirm an audit-style record and a performance/trace record exist, that they include correlation, entity context, and outcome, and that secrets and sensitive amounts are absent.

**Acceptance Scenarios**:

1. **Given** a successful sample mutation probe, **When** an operator reviews the audit trail, **Then** they see time, legal-entity context, action, material before/after fields, and an actor slot (system or operator identifier until identity is specified).
2. **Given** any platform request, **When** it completes or fails, **Then** an operator can find a correlation identifier, legal-entity context when it was present, outcome, and duration.
3. **Given** logs, traces, and audit extracts, **When** they are inspected, **Then** they do not contain secrets or raw cost, margin, or equivalent sensitive amounts.
4. **Given** a refused or invalid request, **When** the platform responds, **Then** it uses the standard error format and does not record a successful mutation.

---

### Edge Cases

- Ready check while the process is live but financial context failed to load: not ready, with a reason that names context load—not a generic "down."
- Ready check while the data store is reachable but baseline structure is not applied: not ready.
- `X-Entity-Context` missing, empty, unknown, or malformed on a business-bound probe: fail closed; do not default to Entity A or to consolidated.
- Consolidated scope on a read probe of empty data: empty combined result is allowed; a write probe MUST be refused by the published rule even if no finance module exists yet.
- Non-finance visibility class requests restricted fields explicitly: the fields remain absent from what is delivered.
- Visibility class omitted on a probe that includes cost or margin: fail closed or treat as non-finance (omit restricted fields); MUST NOT default to finance visibility.
- Page size 0, negative, or far above the allowed maximum: reject or clamp per the published contract; never return an unbounded list.
- Contract version requested that the platform does not serve: typed error; do not silently serve another version.
- Monetary amount with more fractional digits than the currency's published scale: reject or round only per the published rounding rule; never use binary floating point.
- Conversion requested with no FY-period rate: typed error; do not invent a rate or drop currency.
- Fiscal-year boundary at midnight between 31 March and 1 April in Asia/Kolkata: exactly one period; no gap and no overlap.
- Shared platform probe MUST NOT accept a resource name that belongs to a reserved finance module (contract, allocation, invoice, ZATCA, receivable, payable, report, consolidation) as if that module existed.
- Correlation identifier missing from an inbound request: the platform assigns one and returns it; it MUST NOT leave the request untraceable.
- Partial startup (web application up, backend not ready): the web application MUST surface not-ready rather than offering finance-looking empty screens as if modules existed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The product MUST consist of one backend application and one separate web application that start, version, and run independently and communicate only through a published, versioned contract.
- **FR-002**: Shared platform infrastructure (startup, configuration, health, contract conventions, entity context, visibility rules, financial-data rules, logging, audit, tracing) MUST be separate from reserved space for future finance modules.
- **FR-003**: This baseline MUST NOT implement Authentication, Authorization, Contract Management, Resource Allocation, Proforma Invoicing, Tax Invoicing, ZATCA Phase 2, Accounts Receivable, Accounts Payable, Financial Reporting, Financial Consolidation, or any other business feature module.
- **FR-004**: Operators MUST configure the runtime from the environment. Secrets MUST NOT be stored in project source.
- **FR-005**: Operators MUST apply a versioned baseline stored-structure initialization that remains compatible with the currently running system and can be rolled back. The running system MUST NOT create or alter stored structure automatically on startup.
- **FR-006**: At startup the platform MUST load financial context configuration: known legal entities, fiscal-year calendar, base reporting currency, default timezone, and rounding rules. Failure to load MUST keep the system not ready.
- **FR-007**: Operators MUST be able to distinguish a live signal (process is up) from a ready signal (configuration present, data store reachable, baseline structure applied, financial context loaded).
- **FR-008**: Every baseline capability MUST be described in the published versioned contract before it is offered. The web application MUST consume that contract and MUST NOT call undocumented backend behavior.
- **FR-009**: Resource names in the contract MUST follow a single financial naming convention that later modules will extend (plural resource names, versioned base path, no module-specific private aliases in this baseline).
- **FR-010**: Successful responses MUST use one standard envelope. Validation and other failures MUST use one standard typed error format that is actionable, safe for operators, and free of internals, secrets, and other legal entities' data.
- **FR-011**: Collection retrieval MUST be server-paginated. When page size is omitted, the platform MUST return at most 20 items. Unbounded lists are forbidden.
- **FR-012**: Monetary values in the contract and in stored sample data MUST use decimal amounts, an explicit currency code, and the published rounding scale. Binary floating point is forbidden. Server-side arithmetic is authoritative.
- **FR-013**: Business-bound platform requests MUST carry legal-entity context using the published token named `X-Entity-Context` with a value of Entity A, Entity B, Entity C, or All Entities Consolidated. Missing, malformed, or unknown values MUST fail closed and MUST NOT default to another entity or to consolidated.
- **FR-014**: Each business record in this baseline (including sample/probe records) MUST belong to exactly one legal entity.
- **FR-015**: When `X-Entity-Context` is All Entities Consolidated, the scope MUST be read-only. Create, update, void, and submit MUST be refused. Downstream forms in later specifications MUST inherit this context and MUST NOT add an Entity input field; this baseline publishes that rule even though those forms are out of scope.
- **FR-016**: The canonical fiscal year MUST be the Indian Financial Year, 1 April through 31 March, resolved in Asia/Kolkata. Any calendar date MUST map to exactly one fiscal year and exactly one accounting period.
- **FR-017**: When reporting conversion is required, the platform MUST convert to INR using a rate defined for that fiscal-year period, without discarding the original currency amount. Missing rates MUST produce a typed error.
- **FR-018**: Dates and timestamps MUST follow the Asia/Kolkata timezone convention. Fiscal-year boundaries MUST be evaluated in that timezone.
- **FR-019**: Related writes in a single platform probe MUST succeed or fail together. Partial financial writes are forbidden.
- **FR-020**: A sample mutation MUST write an audit record with timestamp, legal-entity context, action, material before/after fields, and an actor slot. This baseline MUST NOT require a signed-in user to exist.
- **FR-021**: Logs, traces, and performance records MUST include a correlation identifier, legal-entity context when present, outcome, and duration, and MUST NOT contain secrets or raw sensitive financial fields (including cost rates and margins).
- **FR-022**: Every request MUST be attributable for duration and outcome so operators can investigate slowness and failure. If no inbound correlation identifier is provided, the platform MUST assign one.
- **FR-023**: The platform MUST provide a reusable server-side visibility rule with at least two classes: finance and non-finance (HR). For the non-finance class, cost rates, margins, and equivalent financial details MUST be omitted from what is delivered. Omission MUST occur on the server. Client-side hiding, blank values, or still-present keys are non-compliant.
- **FR-024**: Verification of FR-023 MUST prove restricted fields are absent from what is delivered to the non-finance class, not only from what is hidden on screen. The finance class MUST still receive those fields on the same sample record.
- **FR-025**: This baseline MUST NOT sign users in or assign roles. A probe MAY declare a visibility class so FR-023 can be proven. A later authentication specification MUST be able to bind a real identity to that class without each module inventing its own redaction.
- **FR-026**: The baseline MAY include sample or probe records solely to prove startup, contract, paging, `X-Entity-Context`, period resolution, money, visibility redaction, audit, and tracing. Those probes MUST live in shared platform space.
- **FR-027**: Layouts this baseline introduces (readiness/not-ready presentation, any probe list) MUST work on Mobile (<640px), Tablet (640px–1024px), and Desktop (>1024px). Dense lists MUST fold into collapsible drawers or stacked cards on smaller screens.
- **FR-028**: Future Phase 1 finance specifications MUST reuse these application, contract, runtime, `X-Entity-Context`, visibility-redaction, financial-data, and cross-cutting rules rather than defining private alternatives.

### Key Entities

- **Platform Runtime**: The independently startable backend application plus the separately startable web application, bound only by the published contract.
- **Shared Platform Area**: Startup, configuration, health, contract conventions, entity context, visibility rules, financial-data rules, logging, audit, and tracing. Not a finance business module.
- **Finance Module Slot**: Reserved attachment point for a later specification (Contract Management, Resource Allocation, Proforma/Tax Invoicing, ZATCA Phase 2, AR, AP, Financial Reporting, Financial Consolidation). Empty in this baseline.
- **Financial Context Configuration**: Startup-loaded set of known legal entities, fiscal-year calendar, base reporting currency, default timezone, and rounding rules.
- **Legal Entity**: An operating company the platform knows (labeled A, B, and C until later specs assign legal names). A business record belongs to exactly one.
- **Legal-Entity Context**: The declared working scope for a business-bound request, carried as `X-Entity-Context`: Entity A, Entity B, Entity C, or All Entities Consolidated (read-only).
- **Visibility Class**: A reusable server-side class (finance or non-finance/HR) that decides whether cost rates, margins, and equivalent financial details are delivered. Not a signed-in role.
- **Fiscal Year Period**: Reporting year starting 1 April and ending 31 March of the following calendar year, in Asia/Kolkata.
- **Accounting Period**: A contiguous interval inside a fiscal year to which an accounting date maps uniquely.
- **Monetary Amount**: Original decimal amount plus currency, optionally with an INR reporting amount bound to a fiscal-year period and rate.
- **Contract Envelope**: The standard success shape, standard error shape, paging metadata, and version identifier used by every baseline capability.
- **Audit Record**: Append-oriented evidence of a mutation: time, legal-entity context, action, material before/after, actor slot.
- **Readiness Status**: Operator-visible live versus ready result, including financial-context load.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can take a clean environment to a ready state (environment configuration applied, baseline structure applied, financial context loaded, live and ready signals correct, both parts started independently) in under 15 minutes using documented steps.
- **SC-002**: In 100% of fault-injection trials (missing configuration, unreachable data store, missing baseline structure, failed financial-context load), the ready signal is false and names a usable reason; 0% of those trials report ready.
- **SC-003**: A reviewer can identify shared platform capabilities versus reserved finance-module space in one pass; 0 finance business modules are offered by this baseline.
- **SC-004**: 100% of baseline list probes that omit page size return at most 20 items. 100% of sampled client errors use the same error shape and contain no secrets and no other legal entity's data.
- **SC-005**: 100% of sampled web-application calls to the backend use only the published versioned contract (no undocumented calls).
- **SC-006**: 100% of business-bound probes that omit or misstate the `X-Entity-Context` token fail closed; 0% default to another entity or to consolidated.
- **SC-007**: For 10 dates spanning March/April boundaries across multiple years, fiscal-year and accounting-period resolution is 100% correct in Asia/Kolkata (1 April–31 March, no gaps or overlaps).
- **SC-008**: 100% of stored sample amounts retain original currency and use decimal representation; 0% of money handling uses binary floating point. Reporting conversion to INR, when a FY-period rate exists, completes without discarding the original amount.
- **SC-009**: For 100% of non-finance visibility-class retrievals of a sample record that contains cost and margin, those fields are entirely absent from what is delivered; 100% of finance visibility-class retrievals of the same record include them.
- **SC-010**: 100% of successful sample mutations produce an audit record from which a reviewer can identify time, legal entity, action, and changed material fields without engineering assistance.
- **SC-011**: For 100% of sampled requests, an operator can locate correlation identifier, legal-entity context when sent, outcome, and duration within 2 minutes of a reported problem.
- **SC-012**: On Mobile, Tablet, and Desktop widths, testers can read readiness status and any probe list without horizontal cramming; dense lists fold into drawers or stacked cards below desktop width.

## Assumptions

- Legal entities remain labeled Entity A, Entity B, and Entity C until a later specification assigns legal names, tax registrations, and jurisdictions.
- Authentication and authorization (sign-in, sessions, and assigning a real person to a role) are specified later. This baseline does not sign users in. An actor slot on audit records is a placeholder for that later specification.
- Field-level redaction is in scope as a reusable server-side visibility rule. A probe declares finance versus non-finance (HR) visibility so the rule can be proven without implementing identity.
- Base reporting currency is INR. Original transaction currencies may include INR and other currencies used by the three entities.
- Fiscal year is the Indian Financial Year (1 April–31 March). Accounting periods default to calendar months inside that year unless a later specification defines custom period sets.
- Default timezone is Asia/Kolkata. All fiscal-year boundaries are evaluated in that timezone.
- Rounding defaults to currency minor-unit scale (two decimal places for INR) using half-up rounding unless a later specification defines a different published rule per currency.
- FY-period conversion rates in this baseline may be operator-maintained reference rates sufficient to prove conversion. Live market-feed FX is out of scope.
- Default list page size is 20 items.
- `X-Entity-Context` is the required published name of the legal-entity context token (values for A, B, C, or consolidated). It is a platform convention for later specifications, not a user-facing form label.
- If a visibility class is omitted on a probe that can return cost or margin, the platform treats the request as non-finance and omits restricted fields (fail safe).
- Delivery topology is constitution-mandated: one backend service, one separate web application, a relational data store, and versioned HTTP contracts. This specification does not prescribe libraries, folders, or table designs.
- Sample/probe capabilities exist only to prove the foundation. They are not product features for accountants.
- Hosting vendor choice and production cluster topology are out of scope.

## Out of Scope

The following MUST NOT be delivered as part of this baseline and will be defined in separate specifications:

- Authentication and authorization (sign-in, sessions, role assignment, and permission grants). Field-level redaction as a reusable platform rule is in scope; binding it to a signed-in person is not.
- Contract Management
- Resource Allocation
- Proforma Invoicing and Tax Invoicing (including Proforma-to-Tax conversion and GST vs SEZ series)
- ZATCA Phase 2 e-invoicing (UBL 2.1, UUID, ICV, PIH, QR codes)
- Accounts Receivable and Accounts Payable
- Financial Reporting and Financial Consolidation
- Chart of Accounts, General Ledger, Payments, Budgeting, Expense Management, and all other business/feature modules
- Statutory tax filing and clearance with any tax authority
- Customer-facing portals and public third-party APIs
