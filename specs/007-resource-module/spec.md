# Feature Specification: Resource Module

**Feature Branch**: `007-resource-module`

**Created**: 2026-08-19

**Status**: Draft

**Input**: Entity-scoped Resource list with server-side search, pagination, and sorting; modal CRUD (Add/View/Edit/Delete); allocation over 100% allowed and highlighted in the list; blur/submit validation; centralized toasts.

## Clarifications

### Session 2026-08-19

- Q: CRUD scope? → A: Full modal CRUD (Add, View, Edit, Delete), matching Clients.
- Q: Entity scope? → A: Entity-scoped like Contracts (`X-Entity-Id`); contract lookup uses the same entity context; create requires a single entity.
- Q: Allocation cap? → A: No upper limit. Values greater than 100 are valid; the list shows an “Over allocated” pill when percent > 100.
- Q: Speckit artifacts? → A: Only `spec.md` for this feature (no plan/research/tasks/openapi copies under 007). OpenAPI lives in the existing committed contracts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage resources in modals (Priority: P1)

A person with `manage_resources` opens Resources from the sidebar and creates, views, edits, or deletes resources using modals. Fields are Resource Type (Inhouse / Vendor / Both), Resource Name, Monthly Allocation %, Contract (searchable), and Month (YYYY-MM).

**Why this priority**: Resources track monthly allocation against contracts per entity; without CRUD, allocation cannot be maintained.

**Independent Test**: Select a single entity, create a resource via modal, view it, edit allocation, then delete it and confirm it leaves the list.

**Acceptance Scenarios**:

1. **Given** a person with `manage_resources` and a single entity selected, **When** they create a valid resource, **Then** it appears in the list and a success toast is shown.
2. **Given** a resource exists, **When** they open View or Edit, **Then** all fields are shown; Edit saves and shows a success toast.
3. **Given** a resource exists, **When** they delete it, **Then** it is removed and a success toast is shown.
4. **Given** All Entities is selected, **When** they try to Add, **Then** Add is disabled and the API refuses create with `entity_context_required`.
5. **Given** Monthly Allocation % is 150, **When** they save, **Then** the create succeeds (no upper cap).

---

### User Story 2 - Server-side search, pagination, and sorting (Priority: P1)

The Resources list supports server-side search, page size (10/25/50), current page, total count, previous/next, and sorting on each sortable column. URL query parameters `search`, `page`, `pageSize`, `sortBy`, and `sortOrder` preserve state on refresh and browser back/forward. Changing search resets to page 1.

**Why this priority**: Unbounded lists violate performance expectations; URL state makes filters shareable and durable.

**Independent Test**: Seed more than one page of rows, change sort and page in the URL, refresh, and confirm the same view loads; search and confirm page resets to 1.

**Acceptance Scenarios**:

1. **Given** more than 10 resources, **When** page size is 10, **Then** only one page is returned with the correct `total`.
2. **Given** a search term, **When** the person types and waits for debounce, **Then** the API is called with `search` and `page=1`.
3. **Given** `?search=alex&page=2&pageSize=25&sortBy=name&sortOrder=desc` in the URL, **When** refreshed, **Then** the same filters, page, and sort apply.
4. **Given** a sortable column header is clicked, **When** sort changes, **Then** `sortBy`/`sortOrder` update in the URL and page resets to 1.

---

### User Story 3 - Over-allocation indicator (Priority: P1)

In the list, allocation shows the percent value. When `monthlyAllocationPercent > 100`, an **Over allocated** pill appears beside the value. Values ≤ 100 show no pill. Over-allocation is not blocked on create or update.

**Why this priority**: Accountants need to see over-booked resources at a glance without being blocked from recording them.

**Independent Test**: Create a resource at 120%; confirm the list shows 120% and an Over allocated pill; create one at 80% and confirm no pill.

**Acceptance Scenarios**:

1. **Given** a resource with allocation 120, **When** the list loads, **Then** the allocation cell shows 120% and an Over allocated pill.
2. **Given** a resource with allocation 100, **When** the list loads, **Then** no Over allocated pill is shown.

---

### User Story 4 - Form validation on blur and submit (Priority: P1)

Resource forms validate required fields and numeric allocation on blur and on submit. Inline errors appear beside fields without interrupting typing or stealing focus.

**Why this priority**: Clear field errors reduce failed submissions and match the design system.

**Independent Test**: Blur empty Resource Name; confirm inline error; enter allocation 150 and submit; confirm it is accepted; submit with missing fields and confirm errors without focus loss.

**Acceptance Scenarios**:

1. **Given** the create modal, **When** Resource Name is blurred empty, **Then** an inline required error appears.
2. **Given** missing required fields, **When** the person submits, **Then** submit is blocked and inline errors show.
3. **Given** allocation 150, **When** the person submits a otherwise-valid form, **Then** create succeeds.

---

### User Story 5 - Centralized toasts for mutations (Priority: P1)

Successful create/update/delete show a success toast. Failed API operations show an error toast preferring the server `message`. List load failures use in-page error, not toasts.

**Acceptance Scenarios**:

1. **Given** a successful create, **When** the API returns 201, **Then** a success toast appears.
2. **Given** a failed create, **When** the API returns an error, **Then** an error toast shows the server message.

## Non-goals

- Sorting on Clients, Contracts, Users, or Roles lists
- Linking Resources to contract-wizard `ContractResource` rows
- Changing the create-contract wizard

## Functional Requirements

- **FR-001**: System MUST provide entity-scoped Resource CRUD via `/resources` gated by `manage_resources`. Resource managers MAY list contracts via `GET /contracts` for the contract picker without `manage_contracts`; contract create/update/delete still require `manage_contracts`.
- **FR-002**: Resource create/update MUST require resourceType (`inhouse`|`vendor`|`both`), name, monthlyAllocationPercent (number, no maximum), contractId, and month (`YYYY-MM`).
- **FR-003**: List and mutations MUST respect `X-Entity-Id`; create/update/delete require a concrete entity UUID.
- **FR-004**: `GET /resources` MUST support `search`, `page`, `pageSize`, `sortBy`, and `sortOrder` with `total` in the response.
- **FR-005**: List UI MUST sync those query params to the URL and reset page when search or sort changes.
- **FR-006**: When monthlyAllocationPercent > 100, the list MUST show an Over allocated pill; values ≤ 100 MUST NOT.
- **FR-007**: Forms MUST validate on blur and submit with inline field errors; mutations MUST use the centralized toast service.

## Success Criteria

- Resources sidebar page with modal Create/View/Edit/Delete works end-to-end under a selected entity.
- List is server-paginated, searchable, sortable, and URL-driven.
- Over-allocation (> 100) is allowed and visually indicated in the list.
- OpenAPI remains SSOT; backend and frontend tests cover resources CRUD, pagination, sort, and over-allocation UI.
