# Feature Specification: Microsoft Authentication with RBAC

**Feature Branch**: `002-microsoft-auth-rbac`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Implement Microsoft authentication with RBAC using Finance User, HR User, PMO User, and Entity Admin roles"

## Clarifications

### Session 2026-08-14

- Q: How dynamic should roles and permissions be in this feature? → A: Assign only. Roles and permissions exist as data (not hardcoded names). This feature only assigns, changes, or revokes a person’s role. Creating or editing roles and permissions is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in with Microsoft (Priority: P1)

A person who is not signed in opens FlyAccounts and is asked to sign in with their organizational Microsoft work or school account. After they complete Microsoft sign-in successfully, they are in the application. If they cancel or Microsoft rejects the sign-in, they stay unsigned and cannot use the application.

**Why this priority**: Every later access rule depends on knowing who the person is. The foundation stage allowed an unsigned confirmation page; this feature replaces that with a real identity.

**Independent Test**: Open the application unsigned, complete Microsoft sign-in with a valid organizational account, and confirm the person is in the application. Cancel or fail sign-in and confirm they cannot reach any signed-in screen.

**Acceptance Scenarios**:

1. **Given** a person is not signed in, **When** they open FlyAccounts, **Then** they are asked to sign in with Microsoft and do not see a role landing, access administration, or the former public confirmation page as a successful signed-in home.
2. **Given** a person is on the sign-in path, **When** they complete Microsoft sign-in with a valid organizational work or school account, **Then** they are signed in and the application knows their Microsoft identity.
3. **Given** a person is on the sign-in path, **When** they cancel sign-in or Microsoft rejects it, **Then** they remain unsigned and cannot open any signed-in screen.
4. **Given** a person tries to sign in with a personal Microsoft account, **When** they complete that attempt, **Then** they are not granted access.

---

### User Story 2 - Access requires a recognized role (Priority: P1)

A person who has signed in with Microsoft but has not been given a FlyAccounts role sees only a pending-access message. They cannot open a role landing or access administration, and they cannot assign roles.

**Why this priority**: Microsoft only proves identity. Without a role, the person must not see authorized work. This is the safe default for every new signer.

**Independent Test**: Sign in as a person who has never been assigned a role. Confirm pending access is shown and that no role landing or access administration is reachable.

**Acceptance Scenarios**:

1. **Given** a person has signed in and has no FlyAccounts role, **When** they use the application, **Then** they see a pending-access message and no role landing.
2. **Given** a person has signed in and has no FlyAccounts role, **When** they try to open a role landing or access administration, **Then** they are refused and remain on pending access.
3. **Given** a person is on pending access, **When** someone whose assigned role includes the access-administration permission later assigns them a role, **Then** their next use of the application shows that role’s authorized landing instead of pending access.

---

### User Story 3 - Assign and change roles (Priority: P1)

A person whose assigned role includes the access-administration permission sees people who have signed in with Microsoft, assigns each person one existing role, and can change or revoke a role. Assigning a new role replaces the previous one. The organization cannot be left with zero people whose role includes access-administration.

**Why this priority**: Roles are assigned inside FlyAccounts. Until someone with access-administration can grant them, only the configured initial identity (whose role already includes that permission) can do authorized assignment work.

**Independent Test**: Sign in as a person whose role includes access-administration, assign different existing roles to signed-in people, change one person’s role, revoke another person’s role, and confirm the last person with access-administration cannot have that access removed.

**Acceptance Scenarios**:

1. **Given** a person’s assigned role includes access-administration, **When** they open access administration, **Then** they see people who have signed in with Microsoft and can assign an existing role to a person who has no role.
2. **Given** a person already has a role, **When** someone with access-administration assigns a different existing role, **Then** the new role replaces the previous one and the person has exactly one role.
3. **Given** a person has a role, **When** someone with access-administration revokes that role, **Then** the person has no role and sees pending access on their next use.
4. **Given** only one person remains whose role includes access-administration, **When** someone tries to revoke that role or change it to a role that lacks access-administration, **Then** the change is refused and at least one person with access-administration remains.
5. **Given** a person’s assigned role does not include access-administration, **When** they try to assign, change, or revoke roles, **Then** they are refused.

---

### User Story 4 - Authorized landing follows the assigned role (Priority: P1)

After a person has a role, they land on a home that states their name and the assigned role’s name and shows only what that role’s permissions allow. People with different roles see different authorized content when those roles have different permissions. Cost, margin, and other sensitive financial fields appear only when the assigned role includes the permission to view sensitive financial fields. The working-and-connected confirmation from the foundation stage remains available after sign-in on or beside the landing; it is not public.

**Why this priority**: Testers and staff must see immediately that authorization follows the assigned role and its permissions. The standing field policy must be visible even before finance modules exist.

**Independent Test**: Assign at least two existing roles that have different permissions to different people (or the same person in sequence). Open the application as each role and confirm each landing states that role and shows only the content those permissions allow, including sensitive-field visibility.

**Acceptance Scenarios**:

1. **Given** a person has an assigned role, **When** they open the application, **Then** they see an authorized landing that states their name and that role’s name and shows only what that role’s permissions allow.
2. **Given** a person’s assigned role includes the permission to view sensitive financial fields, **When** they view their landing, **Then** cost, margin, and other sensitive financial fields are visible.
3. **Given** a person’s assigned role does not include the permission to view sensitive financial fields, **When** they view their landing, **Then** cost, margin, and other sensitive financial fields are not visible.
4. **Given** two people have different roles with different permissions, **When** each opens the application, **Then** each sees a landing that matches their own role and does not show the other role’s authorized content.
5. **Given** a person has one role, **When** they try to open another role’s landing, **Then** they are refused and remain on their own landing.
6. **Given** a signed-in person with a recognized role, **When** they view their landing, **Then** they can still see whether the application is working and connected, and that confirmation is not available to unsigned people.

---

### User Story 5 - Sign out (Priority: P2)

A signed-in person can sign out. After they sign out, the next visit requires Microsoft sign-in again. Role landings, pending access, and access administration are not reachable until they sign in again.

**Why this priority**: People share devices and must be able to end their session. Sign-out is required once sign-in exists, but it is not needed to prove the role model.

**Independent Test**: Sign in, open a landing or pending access, sign out, and confirm the next visit requires Microsoft sign-in and does not show the previous landing.

**Acceptance Scenarios**:

1. **Given** a person is signed in, **When** they sign out, **Then** they are unsigned and see the sign-in path.
2. **Given** a person has signed out, **When** they open the application again, **Then** they must sign in with Microsoft before they can see pending access or a role landing.
3. **Given** a person has signed out, **When** they try to reopen a previous landing or access administration view, **Then** they are refused until they sign in again.

---

### Edge Cases

- Microsoft sign-in succeeds but the organization is not accepted (personal account or unknown directory): the person is not granted access and is not treated as pending for role assignment.
- A signed-in person has no role: they see pending access only; they do not see another person’s landing or access administration.
- A person with access-administration assigns a role to themselves: they keep exactly one role; if the new role lacks access-administration and they are not the last person with that permission, they lose administration and see the new role’s landing.
- Someone tries to revoke or change the last remaining role that includes access-administration: the change is refused and a clear message explains that at least one person with access-administration must remain.
- Two people have access-administration and one of those roles is revoked: the remaining person can still assign, change, and revoke roles.
- A person’s role is changed while they are using the application: their next request uses the new role and its permissions; they must not keep seeing the old landing’s authorized content.
- A person’s role is revoked while they are using the application: their next request shows pending access, not the old landing.
- The configured initial Microsoft identity signs in for the first time: they receive a role that already includes access-administration without another person assigning it, then they can assign roles to others.
- The configured initial Microsoft identity is missing or does not match the signed-in person: that person is treated as having no role (pending access) unless someone with access-administration assigns one.
- Sign-in is cancelled, interrupted, or rejected: the person remains unsigned; the application does not show a successful signed-in state.
- The person refreshes or returns later while still signed in: they see pending access or their current role landing, not the unsigned sign-in path.
- Secrets and the designated initial Microsoft identity are not stored in project source.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: FlyAccounts MUST require a person to sign in with an organizational Microsoft work or school account before they can use the application.
- **FR-002**: The application MUST reject personal Microsoft accounts and MUST NOT grant them access or pending-access status.
- **FR-003**: Cancelled, interrupted, or rejected Microsoft sign-in MUST leave the person unsigned and MUST NOT show a signed-in success state.
- **FR-004**: A signed-in person with no FlyAccounts role MUST see only a pending-access message and MUST NOT see any role landing or access administration.
- **FR-005**: Roles and permissions MUST exist as data. They MUST NOT be a fixed named set in the application. This feature MUST NOT create or edit roles or permissions.
- **FR-006**: A person MUST have at most one role at a time. Assigning a different role MUST replace the previous role.
- **FR-007**: Only a person whose assigned role includes the access-administration permission MUST be able to assign, change, or revoke roles for people who have signed in with Microsoft.
- **FR-008**: A person with access-administration MUST be able to see people who have signed in with Microsoft and assign an existing role to a person who has no role.
- **FR-009**: A person with access-administration MUST be able to change a person’s role to a different existing role, and MUST be able to revoke a role so the person has none.
- **FR-010**: The application MUST refuse any change that would leave the organization with zero people whose role includes access-administration.
- **FR-011**: A designated initial Microsoft identity MUST be supplied by environment configuration, not by project source. When that identity signs in, the person MUST receive a role that already includes access-administration without another person assigning it.
- **FR-012**: After a role is assigned, the person MUST land on an authorized home that states their name and the assigned role’s name and shows only what that role’s permissions allow.
- **FR-013**: Cost, margin, and other sensitive financial fields MUST be visible only when the assigned role includes the permission to view sensitive financial fields. They MUST NOT be visible when that permission is absent.
- **FR-014**: A person MUST NOT be able to open another role’s landing. Authorization MUST be enforced where data is provided, not only by hiding controls on the screen.
- **FR-015**: A signed-in person with a recognized role MUST still be able to see whether the application is working and connected. Unsigned people MUST NOT see that confirmation as a public home.
- **FR-016**: A signed-in person MUST be able to sign out. After sign-out, pending access, role landings, and access administration MUST NOT be reachable until they sign in again.
- **FR-017**: The application MUST NOT offer a dummy, bypass, or local-password sign-in path.
- **FR-018**: Configuration secrets and the designated initial Microsoft identity MUST NOT be stored in project source.
- **FR-019**: Sign-in, pending access, role landings, and access administration MUST be readable and usable on phone, tablet, and desktop, and MUST be usable with a keyboard.
- **FR-020**: When a person’s role is changed or revoked, the application MUST apply the new access on the next request and MUST NOT continue serving the previous landing’s authorized content.
- **FR-021**: Each role MUST carry the permissions attached to it as data. The landing and every protected action MUST follow those permissions.

### Key Entities

- **User**: A person identified by their organizational Microsoft account. Key attributes: Microsoft identity, display name, and whether they are signed in.
- **Role**: A named grouping of permissions. Roles exist as data and are not a closed named list. This feature does not create or edit roles.
- **Permission**: A named capability attached to a role (including access-administration and view sensitive financial fields). Permissions exist as data. This feature does not create or edit permissions.
- **Role Assignment**: The link between a User and at most one Role. Created, changed, or revoked by a person whose role includes access-administration, except the configured initial assignment.
- **Session**: The signed-in period after Microsoft sign-in. Ends when the person signs out. Without a session, no pending access or landing is available.
- **Authorized Landing**: The home shown after sign-in when the person has a role. It states the assigned role’s name and shows only what that role’s permissions allow.
- **Pending Access**: The state and message shown when a person is signed in but has no role.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a supervised walkthrough, 100% of testers with a valid organizational Microsoft account complete sign-in and reach either pending access or their role landing within 60 seconds of starting sign-in.
- **SC-002**: 0% of unsigned testers reach pending access, a role landing, access administration, or the working-and-connected confirmation as a public home.
- **SC-003**: 100% of testers who are signed in with no role see pending access, and 0% of them see a role landing or access administration.
- **SC-004**: A person with access-administration can assign at least two existing roles that have different permissions; 100% of those testers then see a landing that states their assigned role, and 0% see the other role’s authorized content.
- **SC-005**: Across those two roles, testers observe cost and margin only when the assigned role includes the permission to view sensitive financial fields (2 of 2 role checks match the field policy).
- **SC-006**: After sign-out, 100% of testers are returned to the sign-in path, and 0% can reopen a previous landing without signing in again.
- **SC-007**: Attempts to revoke or change the last role that includes access-administration fail in 100% of trials, and at least one person with access-administration remains.
- **SC-008**: Reviewers find 0 dummy or bypass sign-in paths and 0 committed secrets or committed initial-identity values.
- **SC-009**: On phone, tablet, and desktop widths, testers can complete sign-in, read pending access or their landing, and (when their role includes access-administration) assign a role without horizontal cramming, using a keyboard for the same tasks.

## Assumptions

- Microsoft proves identity only. FlyAccounts roles are assigned inside the application by a person whose role includes access-administration.
- Only organizational Microsoft work or school accounts are accepted. Personal Microsoft accounts are out of scope.
- A person has at most one role at a time. A new assignment replaces the previous role.
- Roles and permissions already exist as data supplied outside this feature. This feature does not create, rename, or edit them.
- The first person who can assign roles is designated by environment configuration (a Microsoft identity). When they sign in, they receive a role that already includes access-administration, then they assign roles to others. This avoids dummy sign-in and first-admin lockout.
- A signed-in person with no role sees pending access, not a role landing.
- Access-administration in this feature is application-wide. Legal-entity switching (Entity A, Entity B, Entity C, or All Entities Consolidated) is specified in a later feature.
- Standing field policy: cost, margin, and other sensitive financial fields are visible only when the assigned role includes the permission to view sensitive financial fields.
- The foundation working-and-connected confirmation remains available after sign-in on or beside the role landing. It is no longer a public unsigned home. This feature supersedes the foundation assumption that the confirmation page may be opened without signing in.
- Later modules MUST honor the assigned role’s permissions. Those modules are not built in this feature.
- Role landings are authorized homes for testers and staff to see that access follows the assigned role and its permissions. They are not full workplaces for later modules.
- People who appear in access administration are people who have already signed in with Microsoft. Inviting someone who has never signed in is out of scope.
- Delivery remains one backend and one frontend bound by a published contract, per the project constitution.

## Out of Scope

The following MUST NOT be delivered in this feature:

- Creating, renaming, editing, or deleting roles or permissions
- Legal-entity switching and the consolidated read-only view
- Contract Management, Resource Allocation, invoicing, payments, ledgers, reporting, tax, ZATCA, and other business modules beyond the role landings and standing field policy
- Personal Microsoft accounts
- Self-service role request or approval workflows
- Multiple roles on one person at the same time
- Local username and password, or any dummy or bypass sign-in
- Inviting or provisioning people who have never signed in with Microsoft
- In-app management of Microsoft directory accounts
