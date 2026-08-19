# Feature Specification: Contracts Module (list + wizard)

**Feature Branch**: `005-contracts-module`

**Created**: 2026-08-17

**Status**: Draft

**Input**: Contracts list with Entity Switcher context and a 4-step New Contract create wizard; View/Edit/Delete, audit trail, and over-allocation deferred.

## Clarifications

### Session 2026-08-17

- Q: Delivery scope? → A: List + create wizard only. View/Edit/Delete, audit, and over-allocation deferred.
- Q: Seeded entities? → A: Entity A, Entity B, Entity C. A/B allow INR and USD; C allows SAR and USD. All Entities is consolidated read-only.
- Q: Entity on forms? → A: No. Entity comes only from the top-bar switcher / `X-Entity-Id`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Switch legal entity context (Priority: P1)

A signed-in person with contract access sees a top-bar Entity Switcher with Entity A, Entity B, Entity C, and All Entities. Selecting an option updates the global context pill and scopes Contracts list data to that choice. The selection persists for the browser session.

**Why this priority**: Every contract screen inherits this context; wrong entity means wrong currency and wrong rows.

**Independent Test**: Sign in with `manage_contracts`, change the switcher between Entity A and All Entities, and confirm the Contracts list refetches and the context pill updates.

**Acceptance Scenarios**:

1. **Given** a person with `manage_contracts`, **When** they open Contracts, **Then** they see the Entity Switcher and a context pill for the active selection.
2. **Given** Entity A is selected, **When** they open the New Contract wizard, **Then** currency options are limited to currencies allowed for Entity A and no Entity field appears on the form.
3. **Given** All Entities is selected, **When** they view the Contracts list, **Then** they see a consolidated list and `+ New Contract` is disabled.

---

### User Story 2 - Browse and filter contracts (Priority: P1)

A person with `manage_contracts` opens Contracts from the sidebar, searches by reference or closure owner, and filters by status pills (All, Active, On Hold, Support, Cancelled). Row actions View/Edit/Delete are visible but disabled with “Coming soon”.

**Why this priority**: Day-to-day work starts from finding the right contract in the correct entity.

**Independent Test**: Create contracts in Entity A and Entity B, filter by status and search text under Entity A, then switch to All Entities and confirm both appear.

**Acceptance Scenarios**:

1. **Given** contracts exist in Entity A, **When** Entity A is selected and status Active is chosen, **Then** only Active Entity A contracts appear.
2. **Given** a search term matching a reference, **When** the person searches, **Then** only matching contracts appear.
3. **Given** the list is shown, **When** View/Edit/Delete are inspected, **Then** they are not wired and show “Coming soon”.

---

### User Story 3 - Create a contract with the 4-step wizard (Priority: P1)

With a single entity selected, a person with `manage_contracts` opens `+ New Contract` and completes four steps: upload and category; closure/period/status; payment and milestones; resource configuration. Submit creates the contract under the active entity.

**Why this priority**: Create is the only write path in this MVP.

**Independent Test**: Complete the wizard for Entity C with SAR, submit, and confirm the new row appears only under Entity C (and under All Entities).

**Acceptance Scenarios**:

1. **Given** Entity B is selected, **When** the person completes a valid wizard and submits, **Then** a contract is created for Entity B.
2. **Given** All Entities is selected, **When** they try to create, **Then** create is refused.
3. **Given** end date before start date or a currency not allowed for the entity, **When** they submit, **Then** the create is refused.
4. **Given** Amendment is Yes, **When** they choose a reference, **Then** reference is selected from existing contracts rather than free text only.

---

### User Story 4 - HR cannot see contract money fields (Priority: P1)

A person with `manage_contracts` but without `view_contract_financials` can list and create operational fields, but list and wizard omit cost/value/rate amounts.

**Why this priority**: Constitution and standing field policy require money redaction for HR-capable access.

**Independent Test**: Sign in as HR-style role, open list and wizard, confirm payment amounts and Cost of Resource are absent while allocation and period remain.

**Acceptance Scenarios**:

1. **Given** a caller lacks `view_contract_financials`, **When** they list contracts, **Then** financial amount fields are omitted and payment display is redacted.
2. **Given** the same caller opens the wizard, **When** they reach payment and resource steps, **Then** Cost of Resource and payment amount inputs are hidden.

## Non-goals

- Contract View detail (billing progress, milestone stats)
- Edit / amendment mode beyond create-time amendment flag
- Soft Delete
- Audit trail API/UI beyond create attribution
- Over-allocation capacity checks and alerts
- Outbound email

## Success Criteria

- Entity Switcher scopes list and create; All Entities is read-only for create.
- OpenAPI v5.0.0 is the SSOT; frontend types are generated from it.
- Seeded Entity A/B/C with documented currencies.
- Backend and frontend tests cover entity scope, create validation, and financial redaction.
