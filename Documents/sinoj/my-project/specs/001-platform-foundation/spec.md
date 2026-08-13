# Feature Specification: Platform Foundation (Phase 1)

**Feature Branch**: `001-platform-foundation`

**Created**: 2026-08-13

**Status**: Draft

**Input**: User description: "Build the foundational architecture and system baseline for a Multi-Entity, Multi-Currency Contract-to-Cash Management Platform (Phase 1). The system consists of a FastAPI backend, a React web frontend, and a PostgreSQL database communicating strictly via versioned REST APIs, designed for multi-tenant isolation and strict role-based data visibility. This baseline serves as the application foundation that all subsequent business feature specs (Contract Management, Resource Allocation, Proforma & Tax Invoicing, ZATCA Phase 2 Compliance, and Financial Dashboards) will build upon. The foundation must establish: (1) core application structure, multi-entity context propagation (X-Entity-Context), and database tenant boundaries across Entities A, B, and C, (2) standardized REST API conventions, including request/response envelopes, standard error formatting, and role-restricted response schemas (such as automatically redacting cost and margin fields for HR roles), (3) application initialization, environment configuration, database migration baseline, and health/readiness reporting, and (4) cross-cutting non-functional conventions for financial audit trailing, multi-currency normalization to the Indian Financial Year (April 1 – March 31), and performance logging. Specific business feature workflows and statutory tax integrations are explicitly out of scope for this baseline and will be defined in dedicated feature specs."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch and inherit global entity context (Priority: P1)

An authenticated user selects the working entity once — Entity A, Entity B, Entity C, or All Entities Consolidated — from a persistent control in the application shell. Every subsequent screen and action inherits that selection. Downstream forms never ask the user to pick an entity again. When the user is in a single entity, they only see and can change data that belongs to that entity. When they choose All Entities Consolidated, they may review combined information but cannot create, change, void, or submit records.

**Why this priority**: Every later business module depends on a single, trusted entity scope. If this is wrong, contracts, invoices, and reports will mix legal entities.

**Independent Test**: Sign in as a user permitted for Entity A and Entity B. Select Entity A, open a baseline list of sample records, and confirm only Entity A rows appear and no form shows an Entity field. Switch to Entity B and confirm the list refreshes to Entity B only. Switch to All Entities Consolidated and confirm combined read access plus rejection of any create or change action.

**Acceptance Scenarios**:

1. **Given** an authenticated user permitted for Entity A, **When** they select Entity A as the global context, **Then** all subsequent views show only Entity A data and no downstream form presents an Entity input.
2. **Given** a user working in Entity A with lists or drafts open, **When** they switch the global context to Entity B, **Then** those views refresh to Entity B and Entity A drafts are no longer actionable in the new context.
3. **Given** a user with consolidated permission who selects All Entities Consolidated, **When** they view records, **Then** they see combined Entity A, B, and C information in a read-only mode.
4. **Given** All Entities Consolidated is active, **When** the user attempts to create, update, void, or submit a record, **Then** the system refuses the action and explains that consolidated view is read-only.
5. **Given** a user who is not permitted for Entity C, **When** they attempt to select Entity C or access Entity C data, **Then** the system refuses the request and does not reveal Entity C records.

---

### User Story 2 - Hide cost and margin from HR (Priority: P1)

An HR user works in the same application as finance colleagues. Whenever a screen or export would otherwise include cost rates, margins, or equivalent financial details, the HR user never receives those figures. Finance and Platform Admin users who are allowed to see them still receive the full picture. Hiding values only on the screen is not enough; the restricted data must not be delivered to the HR user at all.

**Why this priority**: Cost rates and margins are regulated commercial data. Client-side hiding is not a control. Later modules cannot be trusted unless field-level visibility is proven on this baseline.

**Independent Test**: Using the same sample record that includes cost and margin, request it as an HR user and as a Finance user. Confirm the HR payload and screen omit those fields entirely, while the Finance user sees them. Confirm an HR user cannot obtain the omitted values by another path in this baseline.

**Acceptance Scenarios**:

1. **Given** a sample record that contains cost rate and margin, **When** a Finance user retrieves it, **Then** cost rate and margin are present.
2. **Given** the same record, **When** an HR user retrieves it, **Then** cost rate, margin, and equivalent financial details are absent from what the user receives — not blanked, not zeroed, not merely hidden on screen.
3. **Given** an HR user, **When** they use list, detail, or any other baseline retrieval for that record, **Then** none of those paths expose the restricted fields.
4. **Given** a Platform Admin, **When** they retrieve the same record, **Then** they receive the same financial fields as a Finance user.

---

### User Story 3 - Bring the platform up and confirm it is ready (Priority: P1)

An operator configures the running environment without committing secrets, applies the baseline data structure, and starts the web application and the backend service as two separately runnable parts. They can tell whether the service is merely up versus actually ready to serve work (configuration present, data store reachable, baseline structure applied). Other feature work must not begin until readiness is confirmed.

**Why this priority**: Later modules assume a bootable, inspectable platform. A laptop-only happy path is not a foundation.

**Independent Test**: Start from a clean environment, supply configuration, apply the baseline structure, start both parts of the application, and confirm a live signal versus a ready signal. Confirm missing configuration or an unreachable data store yields not-ready, not a silent success.

**Acceptance Scenarios**:

1. **Given** valid environment configuration and a reachable data store, **When** the operator applies the baseline structure and starts the system, **Then** both the web application and the backend service start independently and the ready signal reports success.
2. **Given** the system is running, **When** an operator asks whether it is live, **Then** they receive a clear live indication even if downstream dependencies are still settling.
3. **Given** required configuration is missing or the data store is unreachable, **When** an operator asks whether it is ready, **Then** the system reports not ready with an actionable reason and does not present itself as ready.
4. **Given** secrets and environment-specific values, **When** the system is configured, **Then** those values come from the environment and are not stored in the project source.

---

### User Story 4 - Get consistent responses, errors, and paging (Priority: P2)

Users and future module authors always receive the same shape of success and failure. Lists arrive in pages (default 20 items) rather than unbounded dumps. Failures explain what went wrong in a stable, user-safe format without leaking other entities' data or restricted financial fields. All baseline capabilities share one versioned contract so later features do not invent private formats.

**Why this priority**: Contract-to-cash modules will multiply quickly. Inconsistent errors and unbounded lists will make the product unsupportable.

**Independent Test**: Call a successful baseline list, a validation failure, a missing-record failure, and an entity-isolation failure. Confirm one success envelope, one error format, default page size 20, and no leakage of other entities or HR-restricted fields in errors.

**Acceptance Scenarios**:

1. **Given** a successful baseline list request with no page size specified, **When** more than 20 matching items exist, **Then** the user receives at most 20 items plus enough paging information to request the next page.
2. **Given** an invalid request, **When** the system rejects it, **Then** the user receives a typed, actionable error in the standard format and does not receive stack traces, secrets, or other entities' data.
3. **Given** a request for a record that does not exist in the current entity context, **When** the system responds, **Then** the outcome is a standard not-found (or equivalent closed failure) and does not confirm that the record exists in another entity.
4. **Given** any baseline capability, **When** a client follows the published versioned contract, **Then** success and error shapes match that contract.

---

### User Story 5 - Reconstruct who changed what (Priority: P2)

When a user creates or changes a baseline record, the system records who did it, when, under which entity context, and the material before-and-after fields. Operators can reconstruct a mutation without reading restricted cost or margin values from logs. Audit evidence is retained as a first-class record, not only as a transient log line.

**Why this priority**: Financial products that cannot explain a change cannot be audited. This baseline must set the trail that invoicing and contracts will reuse.

**Independent Test**: Perform a permitted create and update on a sample record, then retrieve the audit trail and confirm actor, time, entity scope, and material field changes. Confirm logs and audit output omit secrets and HR-restricted amounts.

**Acceptance Scenarios**:

1. **Given** an authenticated Finance user in Entity A, **When** they create or update a sample record, **Then** an audit event stores actor, timestamp, entity scope, action, and material before/after fields.
2. **Given** that mutation, **When** an authorized operator reviews the trail, **Then** they can identify who changed what without consulting an engineer.
3. **Given** a mutation that includes cost or margin, **When** logs or audit extracts are produced, **Then** secrets, cost rates, and margins are not written into general-purpose logs.
4. **Given** a refused action (wrong entity or consolidated write), **When** the refusal occurs, **Then** the system does not record a successful mutation.

---

### User Story 6 - Use Indian Financial Year and multi-currency money rules (Priority: P3)

Anyone working with dates or money on this platform uses one calendar and one money rule. The reporting year runs 1 April through 31 March. Amounts keep their original currency. When a reporting conversion is required, it uses the Indian Financial Year period and a single base reporting currency (INR). Later modules must not invent a January–December year or floating-point money.

**Why this priority**: Contract-to-cash reporting will span currencies and fiscal periods. If the foundation is ambiguous, every dashboard and invoice total will disagree.

**Independent Test**: Ask the system for the financial-year bounds of a date in March and a date in April; confirm March belongs to the year that started the previous April. Record a sample amount in a non-INR currency and confirm original currency is preserved and a FY-period INR reporting conversion is available without using imprecise binary floating point.

**Acceptance Scenarios**:

1. **Given** the date 31 March 2027, **When** the system resolves its Indian Financial Year, **Then** the period is 1 April 2026 through 31 March 2027.
2. **Given** the date 1 April 2027, **When** the system resolves its Indian Financial Year, **Then** the period is 1 April 2027 through 31 March 2028.
3. **Given** a sample monetary amount in a non-INR currency, **When** it is stored, **Then** the original currency and original amount are preserved.
4. **Given** that amount and a defined FY-period conversion rate to INR, **When** reporting conversion is requested, **Then** the system returns an INR reporting amount for that financial year without treating money as binary floating point.

---

### User Story 7 - Attribute slow or failed work (Priority: P3)

When a request is slow or fails, an operator can tie together what the user did, which entity they were in, a correlation identifier, and how long the work took. This information is available without exposing secrets, cost rates, or margins.

**Why this priority**: Multi-entity finance is undebuggable without scoped timing. Later ZATCA and reporting jobs will need this habit already in place.

**Independent Test**: Issue a baseline request and confirm a correlation identifier, actor, entity scope, outcome, and duration are recorded. Confirm restricted fields are absent from that record.

**Acceptance Scenarios**:

1. **Given** an authenticated request in Entity B, **When** the request completes, **Then** operators can find a correlation identifier, actor, entity scope, outcome, and duration for that request.
2. **Given** a failed request, **When** an operator investigates, **Then** they can distinguish validation failure, permission failure, and dependency failure without reading source code.
3. **Given** performance records, **When** they are inspected, **Then** they do not contain secrets, cost rates, or margins.

---

### Edge Cases

- User has no entity permission at all: sign-in succeeds or fails per identity rules, but no business context can be established; business actions fail closed.
- User selects an entity, then an administrator revokes that entity permission while the session is still open: subsequent requests fail closed and do not continue to serve that entity's data.
- Entity context is missing, malformed, or unknown on a business request: the system fails closed with a standard error; it MUST NOT default to consolidated or to another entity.
- User is permitted for one entity but sends another entity's identifier: the system refuses the request and does not disclose whether the target record exists elsewhere.
- Consolidated context on a read of empty data: the user sees an empty combined result, not an error, provided they have consolidated permission.
- HR user attempts to request restricted fields explicitly (query parameter, export, or alternate view): the fields remain absent.
- Page size requested as 0, negative, or far above the allowed maximum: the system rejects or clamps per the published contract and never returns an unbounded list.
- Readiness check while the data store is up but the baseline structure has not been applied: the system reports not ready.
- Concurrent switch of entity context while a write is in flight: the write is evaluated against the context actually submitted with that request; it MUST NOT silently apply to a different entity.
- Financial year boundary at midnight between 31 March and 1 April MUST resolve to exactly one period with no overlap and no gap.
- Conversion requested with no FY-period rate defined: the system fails with a typed error; it MUST NOT guess a rate or silently omit currency.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to sign in with organization-issued credentials and receive a role of Platform Admin, Finance, or HR, each scoped to one or more entities.
- **FR-002**: Users MUST be able to select a persistent global entity context of Entity A, Entity B, Entity C, or All Entities Consolidated, limited to contexts they are permitted to use.
- **FR-003**: Downstream forms and actions MUST inherit entity context from that global selection and MUST NOT present an Entity input field.
- **FR-004**: Switching entity context MUST refresh dependent lists and drafts so the user cannot act on the previous entity's in-progress work under the new context.
- **FR-005**: All Entities Consolidated MUST be an explicit permission, not a toggle available to every user.
- **FR-006**: When context is All Entities Consolidated, the system MUST allow reads of combined Entity A, B, and C data and MUST reject create, update, void, and submit actions.
- **FR-007**: Business data MUST be isolated by entity. A user in Entity A MUST NOT read or change Entity B or Entity C records. Cross-entity access is allowed only as consolidated read-only per FR-006.
- **FR-008**: Authenticated business requests MUST carry entity context. Missing, malformed, unknown, or unauthorized context MUST fail closed with a standard error and MUST NOT default to another entity or to consolidated.
- **FR-009**: The system MUST enforce object-level permission (can this user access this record in this entity?) before applying field-level visibility.
- **FR-010**: For HR roles, the system MUST omit cost rates, margins, and equivalent financial details from every response the user receives. Omission MUST occur on the server. Client-side hiding, blank values, or still-present keys are non-compliant.
- **FR-011**: Finance and Platform Admin roles that are permitted to view financial details MUST receive cost rates and margins on the same records that HR cannot see.
- **FR-012**: Verification of FR-010 MUST prove restricted fields are absent from what the HR user is delivered, not only from what is hidden on screen.
- **FR-013**: All baseline capabilities MUST be described in a versioned, published contract before they are offered to the web application. The web application MUST consume that contract. The two parts of the product MUST remain independently startable and MUST communicate only through that contract.
- **FR-014**: Successful responses MUST use one standard envelope. Failures MUST use one standard, typed error format that is actionable, safe for users, and free of internals, secrets, other entities' data, and HR-restricted fields.
- **FR-015**: Collection retrieval MUST be server-paginated. When the client does not specify a page size, the system MUST return at most 20 items. Unbounded list retrieval is forbidden.
- **FR-016**: Operators MUST be able to apply a versioned baseline data-structure change that remains compatible with the currently running system and can be rolled back. The running system MUST NOT create or alter stored structure automatically on startup.
- **FR-017**: Operators MUST be able to distinguish a live signal (process is up) from a ready signal (configuration present, data store reachable, baseline structure applied).
- **FR-018**: Configuration, including secrets, MUST come from the environment. Secrets MUST NOT be stored in project source.
- **FR-019**: Monetary amounts MUST be stored and calculated as decimals (not binary floating point), with original currency preserved. Server-side arithmetic is authoritative.
- **FR-020**: The canonical reporting calendar MUST be the Indian Financial Year, 1 April through 31 March. The system MUST resolve any calendar date to exactly one FY period.
- **FR-021**: When reporting conversion is required, the system MUST convert to INR using a rate defined for that Indian Financial Year period, without discarding the original currency amount.
- **FR-022**: Creating or changing a baseline business record MUST write an audit event containing actor, timestamp, entity scope, action, and material before/after fields.
- **FR-023**: General-purpose logs and performance records MUST include correlation identifier, actor, entity scope, and outcome, and MUST NOT contain secrets, cost rates, or margins.
- **FR-024**: Every request MUST be attributable for duration and outcome so operators can investigate slowness and failure.
- **FR-025**: The baseline MAY include sample records solely to prove entity isolation, redaction, paging, audit, and money rules. Those samples MUST NOT implement Contract Management, Resource Allocation, Proforma or Tax Invoicing, ZATCA, or Financial Dashboards.
- **FR-026**: Layouts that this baseline introduces (shell, entity switcher, lists) MUST work on Mobile (<640px), Tablet (640px–1024px), and Desktop (>1024px). Dense lists MUST fold into collapsible drawers or stacked cards on smaller screens.

### Key Entities

- **Legal Entity**: One of the three operating companies on the platform (A, B, or C). Business records belong to exactly one legal entity.
- **User**: A person who signs in. Has one starter role (Platform Admin, Finance, or HR) and a set of entity permissions. May additionally hold consolidated-read permission.
- **Entity Context**: The current working scope — Entity A, Entity B, Entity C, or All Entities Consolidated — inherited by all downstream actions in the session.
- **Role Visibility Rule**: The mapping that decides which fields a role may receive. HR is denied cost rate, margin, and equivalent financial details.
- **Sample Business Record**: A non-production-domain record used only to prove isolation, paging, redaction, audit, and money handling until later feature specs define real documents.
- **Monetary Amount**: An original amount plus original currency, optionally accompanied by an INR reporting amount bound to an Indian Financial Year period and rate.
- **Financial Year Period**: A reporting interval starting 1 April and ending 31 March of the following calendar year.
- **Audit Event**: An append-oriented record of a mutation: who, when, which entity context, what action, and material before/after fields.
- **Readiness Status**: The operator-visible result of live versus ready checks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a supervised walkthrough, 100% of testers who are permitted for two entities can switch global context and see only the selected entity's sample records within 30 seconds, with no Entity field on the next form they open.
- **SC-002**: 100% of attempted creates or updates while All Entities Consolidated is selected are refused; 0% of those attempts persist a change.
- **SC-003**: For 100% of HR retrievals of a sample record that contains cost and margin, those fields are entirely absent from what the HR user receives; 100% of Finance retrievals of the same record include them.
- **SC-004**: Cross-entity leakage is 0%: a user scoped only to Entity A never receives Entity B or Entity C records in lists or detail retrievals.
- **SC-005**: An operator can take a clean environment to a ready state (configuration applied, baseline structure applied, live and ready signals correct) in under 15 minutes using documented steps.
- **SC-006**: 100% of baseline list requests that omit page size return at most 20 items. 100% of sampled client errors use the same error shape and do not include secrets or other entities' data.
- **SC-007**: 100% of successful sample-record creates and updates produce an audit event from which a reviewer can identify actor, time, entity, and changed material fields without engineering assistance.
- **SC-008**: For 10 dates spanning March/April boundaries across multiple years, financial-year resolution is 100% correct (1 April–31 March, no gaps or overlaps).
- **SC-009**: 100% of stored sample amounts retain original currency; 0% of money handling uses binary floating point. Reporting conversion to INR, when a FY-period rate exists, completes without discarding the original amount.
- **SC-010**: For 100% of sampled requests, an operator can locate correlation identifier, actor, entity scope, outcome, and duration within 2 minutes of a reported problem.
- **SC-011**: On Mobile, Tablet, and Desktop widths, testers can complete entity switching and read a sample list without horizontal cramming; dense lists fold into drawers or stacked cards below desktop width.

## Assumptions

- Legal entities remain labeled Entity A, Entity B, and Entity C until a later spec assigns legal names, tax registrations, and jurisdictions.
- Starter roles are Platform Admin, Finance, and HR. Additional roles are out of scope for Phase 1.
- Identity is organization-issued sign-in with a server-enforced session. Single sign-on, social login, and an identity-provider product are out of scope.
- Consolidated access is granted only to users who receive that explicit permission (typically Platform Admin and designated Finance users).
- Sample records exist only as a proving ground for isolation, redaction, paging, audit, FY, and money rules.
- Base reporting currency is INR. Original transaction currencies may include INR and other currencies used by the three entities.
- FY-period conversion rates for this baseline may be operator-maintained reference rates sufficient to prove conversion; live market-feed FX is out of scope.
- Default list page size is 20 items, matching the project constitution.
- Entity context is transported on every authenticated business request as a dedicated context token named `X-Entity-Context` (values for A, B, C, or consolidated). That name is a platform convention for later feature specs, not a user-facing label.
- Delivery topology is constitution-mandated: one backend service, one separate web application, a relational data store, and versioned HTTP contracts. This specification does not prescribe libraries, folders, or table designs.
- Health/readiness, environment configuration, and versioned structure changes are in scope; production hosting vendor choice is not.
- Responsive shell behavior is in scope for the entity switcher and sample lists. Full visual design and brand system are out of scope.

## Out of Scope

The following are explicitly deferred to dedicated feature specifications and MUST NOT be delivered as part of this baseline:

- Contract Management
- Resource Allocation
- Proforma invoicing and Tax invoicing (including Proforma-to-Tax conversion and GST vs SEZ series)
- ZATCA Phase 2 compliance (UBL 2.1, UUID, ICV, PIH, QR codes)
- Financial Dashboards
- Statutory tax filing and clearance with any tax authority
- Payroll, recruiting, and full HRIS workflows (HR appears here only as a visibility role)
- Customer-facing portals and public APIs
