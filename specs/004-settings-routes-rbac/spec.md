# Feature Specification: Settings Routes and MANAGE_* RBAC

**Feature Branch**: `004-settings-routes-rbac`

**Created**: 2026-08-17

**Status**: Draft

**Input**: User description: "Make Users, Roles, and Permissions separate route-based pages; user-specific multi-select role assignment; seed only manage_users, manage_roles, manage_permissions assigned to System Admin; permissions catalog fields name/permission/description grouped by module; right-aligned page actions; skip invite mail for now."

## Clarifications

### Session 2026-08-17

- Q: Seeded permission set? → A: Only `manage_users`, `manage_roles`, `manage_permissions` for nav and Settings APIs. No separate VIEW_* codes.
- Q: Invite email? → A: Deferred. Invites remain in-app DB records; outbound mail is out of scope for this feature.
- Q: Initial admin? → A: Unchanged mechanism: `INITIAL_ADMIN_EMAIL` on Microsoft sign-in assigns the seeded **System Admin** role (holds all three MANAGE_* permissions).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open Settings by URL (Priority: P1)

A person whose combined permissions include the relevant MANAGE_* code opens Settings pages at stable URLs (`/settings/users`, `/settings/roles`, `/settings/permissions`). Navigation is route-based, not in-memory view state. Each sidebar item appears only when that person has the matching permission.

**Independent Test**: Sign in as System Admin, open each Settings URL, confirm the correct page. Sign in without `manage_users` and confirm `/settings/users` is refused or redirected.

**Acceptance Scenarios**:

1. **Given** a person has `manage_users`, **When** they open `/settings/users`, **Then** the Users page is shown.
2. **Given** a person lacks `manage_roles`, **When** they open `/settings/roles`, **Then** they are refused and remain on what their permissions allow (home or pending).
3. **Given** a person has only `manage_permissions`, **When** they use the sidebar, **Then** only Permissions is offered under Settings.

---

### User Story 2 - System Admin bootstrap (Priority: P1)

On first matching Microsoft sign-in, `INITIAL_ADMIN_EMAIL` receives the seeded System Admin role and therefore all three MANAGE_* permissions. Finance/HR/PMO demo roles and `access_administration` are not seeded.

**Independent Test**: Configure `INITIAL_ADMIN_EMAIL`, sign in with that work email on a clean database, confirm System Admin and Settings access.

---

### User Story 3 - Assign roles on the selected person (Priority: P1)

From Users, after selecting a person or invite, an administrator assigns one or more roles via multi-select on the detail panel. There is no top-level shared “Assign Roles” flow that picks an arbitrary person. Assignment adds roles without replacing existing ones. Revoke remains one role at a time. Last-admin refuses removing the last person with `manage_users`.

**Independent Test**: Select a pending user, multi-select two roles, assign, revoke one, confirm last-admin protection.

---

### User Story 4 - Permissions catalog (Priority: P1)

Permissions is a read-only catalog. The API returns permissions grouped by module. Each item shows Permission Name, Permission (stable key), and Description only. Creating permission types remains out of scope. Outbound invite email remains out of scope.

**Independent Test**: Open Permissions, confirm module groups and the three fields per card; confirm no create control.

---

### User Story 5 - Invite without email (Priority: P2)

Invite User still creates an unused invite (optional roles). No email is sent. The invited person must know to sign in with the matching organizational Microsoft account.

## Requirements

### Functional

- **FR-001**: Settings Users, Roles, and Permissions MUST be separate URL routes.
- **FR-002**: People APIs and Users nav require `manage_users`; roles APIs and Roles nav require `manage_roles`; permissions catalog requires `manage_permissions`.
- **FR-003**: Seeded permissions MUST be only those three codes; seeded role MUST be System Admin with all three.
- **FR-004**: `GET /permissions` MUST return `{ modules: [{ module, permissions[] }] }`; each permission MUST include `name`, `permission`, optional `description` (and `id`).
- **FR-005**: Assign-role requests MUST accept `roleIds` (one or more) for a path-scoped person or invite.
- **FR-006**: Users page MUST NOT offer a global Assign Roles control; assignment is detail-scoped with multi-select.
- **FR-007**: Page-level primary actions MUST be right-aligned.
- **FR-008**: Invite MUST NOT send outbound email in this feature.
- **FR-009**: `INITIAL_ADMIN_EMAIL` bootstrap MUST assign System Admin when the signer lacks `manage_users`.
- **FR-010**: Last-admin rules MUST key off `manage_users`.

### Non-goals

- Outbound invitation email / mail service
- Creating or editing permission types in the UI
- Re-seeding Finance/HR/PMO landing permissions in this feature

## Success Criteria

- SC-001: Admin can open each Settings page by URL within one minute of sign-in.
- SC-002: Assigning two roles from a selected person’s detail succeeds without a global assign modal.
- SC-003: Permissions catalog shows only name, permission, description, grouped by module.
