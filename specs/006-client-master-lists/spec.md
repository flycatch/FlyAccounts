# Feature Specification: Client Master, Lists, Validation, and Toasts

**Feature Branch**: `006-client-master-lists`

**Created**: 2026-08-19

**Status**: Draft

**Input**: Global Client master with modal CRUD; contracts reference existing clients; server-side search and pagination on Clients, Contracts, Users, and Roles; blur/submit form validation; centralized toast notifications for mutations.

## Clarifications

### Session 2026-08-19

- Q: Client scope? → A: Global — one client list shared across all legal entities. Contracts still belong to an entity via `X-Entity-Id`.
- Q: Client form required fields? → A: All fields except Notes (Name, Address, Contact Person, Contact Email, Contact Phone, VAT/Tax Registration Number).
- Q: Contract client reference? → A: Removed (contracts no longer reference clients).
- Q: Speckit artifacts? → A: Only `spec.md` for this feature (no plan/research/tasks/openapi copies under 006).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage clients in modals (Priority: P1)

A person with `manage_clients` opens Clients from the sidebar and creates, views, edits, or deletes clients using modals. Fields are Name, Address, Contact Person, Contact Email, Contact Phone, VAT/Tax Registration Number, and optional Notes.

**Why this priority**: Contracts need a reusable counterparty master; without it, client data cannot be shared across contracts.

**Independent Test**: Create a client via modal, view it, edit a field, then delete an unused client and confirm it leaves the list.

**Acceptance Scenarios**:

1. **Given** a person with `manage_clients`, **When** they open Clients and create a valid client, **Then** the client appears in the list and a success toast is shown.
2. **Given** a client exists, **When** they open View or Edit, **Then** all fields are shown; Edit saves changes and shows a success toast.
3. **Given** a client is not linked to any non-deleted contract, **When** they delete it, **Then** the client is removed and a success toast is shown.
4. **Given** a client is linked to one or more non-deleted contracts, **When** they try to delete it, **Then** deletion is refused with a clear dependency error toast (`client_in_use`).

---

### User Story 2 - [DELETED] (Contracts no longer reference clients)

---

### User Story 3 - Server-side search and pagination (Priority: P1)

Clients, Contracts, Users, and Roles lists support server-side search, page size (10/25/50), current page, total count, and previous/next. URL query parameters `search`, `page`, and `pageSize` (plus `status` on Contracts) preserve state on refresh and browser back/forward. Changing search resets to page 1.

**Why this priority**: Unbounded lists violate performance expectations; URL state makes filters shareable and durable.

**Independent Test**: Seed more than one page of rows, change page size and page in the URL, refresh, and confirm the same page loads; search and confirm only matching rows and page resets to 1.

**Acceptance Scenarios**:

1. **Given** more than 10 clients, **When** page size is 10, **Then** only one page of results is returned with the correct `total`.
2. **Given** a search term, **When** the person types and waits for debounce, **Then** the API is called with `search` and `page=1`.
3. **Given** `?search=acme&page=2&pageSize=25` in the URL, **When** the page is refreshed, **Then** the same filters and page are applied.
4. **Given** Users or Roles lists, **When** they search, **Then** filtering is server-side (not only the loaded page).

---

### User Story 4 - Form validation on blur and submit (Priority: P1)

Client, invite, and role forms validate required fields and email format on blur and on submit. Inline errors appear beside fields without interrupting typing or stealing focus. No API call is made while typing for validation alone.

**Why this priority**: Clear field errors reduce failed submissions and match the design system field chrome.

**Independent Test**: Focus and blur an empty required email field; confirm an inline error; type a valid email and blur; confirm the error clears; submit with missing fields and confirm errors without focus loss.

**Acceptance Scenarios**:

1. **Given** the client create modal, **When** Contact Email is blurred empty, **Then** an inline required/email error appears.
2. **Given** invalid email text, **When** the person submits, **Then** submit is blocked and inline errors show.
3. **Given** the person is typing in a field, **When** characters change, **Then** focus is not moved and no validation API is called.

---

### User Story 5 - Centralized toasts for mutations (Priority: P1)

Successful create/update/delete and other user-triggered mutations (assign, revoke, invite, attach permission, etc.) show a success toast. Failed API operations show an error toast with a clear, operation-specific message (preferring server `message`). Duplicate identical toasts are prevented. Toasts do not block forms, modals, navigation, or focus.

**Why this priority**: Inline banners are inconsistent and easy to miss; a single toaster matches the design system.

**Independent Test**: Invite a user, assign a role, create a client, and force a duplicate-name create; confirm success and error toasts appear without stacking duplicates.

**Acceptance Scenarios**:

1. **Given** a successful invite, **When** the API returns 201, **Then** a success toast such as “Invite recorded.” appears.
2. **Given** a failed client delete with `client_in_use`, **When** the API returns 409, **Then** an error toast shows the server message.
3. **Given** the same error is triggered twice quickly with the same message, **When** toasts update, **Then** only one toast of that type+message is visible.
4. **Given** a list fails to load, **When** the page shows an in-page error, **Then** no toast is shown for that load failure.

## Non-goals

- Entity-scoped clients
- Permissions catalog pagination
- Changing `GET /contracts/closure-owners` pagination
- Full Speckit 006 artifact set (plan, research, data-model, tasks, openapi copy)

## Functional Requirements

- **FR-001**: System MUST provide global Client CRUD via `/clients` gated by `manage_clients`.
- **FR-002**: Client create/update MUST require Name, Address, Contact Person, Contact Email, Contact Phone, and VAT; Notes optional; email format validated.
- **FR-003**: Deleting a client linked to non-deleted contracts MUST fail with `client_in_use`.
- **FR-004**: [DELETED] (Contracts no longer reference clients).
- **FR-005**: `GET /clients`, `/contracts`, `/people`, and `/roles` MUST support `search`, `page`, and `pageSize` with `total` in the response.
- **FR-006**: List UIs MUST sync `search`, `page`, and `pageSize` to the URL and reset page when search changes.
- **FR-007**: Forms in scope MUST validate on blur and submit with inline field errors.
- **FR-008**: Mutation success and failure MUST use a centralized toast service with deduplication.

## Success Criteria

- Clients sidebar page with modal Create/View/Edit/Delete works end-to-end.
- [DELETED] (Contracts no longer reference clients).
- Clients, Contracts, Users, and Roles lists are server-paginated and URL-driven.
- Validation is blur+submit with inline errors; mutations use toasts.
- OpenAPI remains SSOT; backend and frontend tests cover clients, pagination, and dependency delete.
