# Feature Specification: Settings User Management

**Feature Branch**: `003-user-management`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Implement a Settings → User Management module where invited users can only use the app based on their assigned roles and permissions, with users supporting multiple roles, roles supporting multiple permissions, and every feature/action controlled by permissions. Update the specification to support both user invitations and organization-based entry, without blocking users who enter through the organization."

## Clarifications

### Session 2026-08-14

- Q: Who may sign in once User Management exists? → A: Dual entry. People may be invited by organizational work email (with zero or more roles), and people with a valid organizational Microsoft account may sign in without an invite. Uninvited organizational accounts are not refused. With no roles they see pending access and appear in User Management so roles can be assigned. Personal Microsoft accounts remain refused. *(This supersedes the earlier same-day answer that required an invite and refused uninvited accounts.)*
- Q: Should admins create or edit roles and permissions? → A: Role management is included. Admins can create, edit, and delete roles and attach or detach existing permissions. Creating new permission types in the application is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Open User Management from Settings (Priority: P1)

A person whose combined permissions include access-administration opens Settings and reaches User Management. There they can work with people (invited and those who entered through the organization) and with roles. A person whose combined permissions do not include access-administration does not see User Management and cannot use it.

**Why this priority**: Invitation, organization-based people, role assignment, and role editing all happen here. Without a gated Settings home, later stories have no place to be done.

**Independent Test**: Sign in as a person with access-administration and confirm Settings → User Management opens. Sign in as a person without that permission and confirm User Management is not offered and cannot be opened.

**Acceptance Scenarios**:

1. **Given** a person’s combined permissions include access-administration, **When** they open Settings, **Then** they can open User Management.
2. **Given** a person’s combined permissions do not include access-administration, **When** they use the application, **Then** they do not see User Management and cannot open it.
3. **Given** a person without access-administration tries to reach User Management anyway, **When** they attempt that, **Then** they are refused and remain on what their combined permissions allow (combined landing or pending access).
4. **Given** User Management is open, **When** the person looks at the module, **Then** they can reach both people (invites, organization-based sign-ins, and assignments) and roles (create, edit, attach permissions) as parts of the same Settings module, not as a separate product.

---

### User Story 2 - Invite a person (Priority: P1)

A person with access-administration invites someone by organizational work email. They may assign one or more existing roles on the invite, or invite with no roles. The invited person does not need to have signed in yet. The same email cannot be invited twice, and an email that already belongs to a person who entered through the organization cannot be invited again. Until that invited person signs in with the matching organizational Microsoft account, they cannot use the application. Invite is optional: people may still enter through the organization without one.

**Why this priority**: Invite is the way to pre-provision a person and attach roles before first sign-in. It is not the only way into the application.

**Independent Test**: From User Management, invite one email with two roles and another email with no roles. Confirm both appear as invited, a duplicate invite of the same email is refused, and neither invited person can use the application until they sign in. Confirm a person who already signed in through the organization cannot be invited as a new email.

**Acceptance Scenarios**:

1. **Given** User Management is open, **When** a person with access-administration invites an organizational work email and assigns one or more existing roles, **Then** that invite is recorded with those roles and the invited person still cannot use the application until they sign in.
2. **Given** User Management is open, **When** a person with access-administration invites an organizational work email with no roles, **Then** that invite is recorded with no roles.
3. **Given** an email has already been invited, **When** someone tries to invite that same email again, **Then** the duplicate is refused and a clear message explains that the person is already invited.
4. **Given** a person has already signed in through the organization, **When** someone tries to invite that same email, **Then** the invite is refused and a clear message explains that the person is already present.
5. **Given** a person’s combined permissions do not include access-administration, **When** they try to invite someone, **Then** they are refused.
6. **Given** a person has been invited and has not signed in, **When** they are listed in User Management, **Then** they are shown as invited and not yet signed in.

---

### User Story 3 - Sign-in follows combined permissions (Priority: P1)

A person signs in with their organizational Microsoft account, whether they were invited or entered through the organization. If they have one or more roles, they land on the combined home that lists every assigned role and shows only what the combined permissions of those roles allow. If they have no roles, they see pending access only. They cannot use any feature or action their combined permissions do not allow.

**Why this priority**: The point of User Management is that every signed-in person uses the application only through assigned roles and permissions, regardless of how they entered.

**Independent Test**: Invite one person with two roles that have different permissions and another with no roles. After each signs in, confirm the first sees the union of both roles and nothing outside it, and the second sees only pending access. Separately, sign in an uninvited organizational account, assign two roles, and confirm the same combined-permission behavior.

**Acceptance Scenarios**:

1. **Given** a person was invited with one or more roles, **When** they sign in with the matching organizational Microsoft account, **Then** they see the combined landing that states their name, lists every assigned role’s name, and shows only what the combined permissions allow.
2. **Given** a person was invited with no roles, **When** they sign in with the matching organizational Microsoft account, **Then** they see pending access only and cannot open the combined landing or User Management.
3. **Given** a person entered through the organization and later received one or more roles, **When** they use the application, **Then** they see the combined landing and only what the combined permissions allow.
4. **Given** one person has two roles with different permissions and another person has only one of those roles, **When** each uses the application, **Then** the first sees the union of both roles’ allowed content and actions, and the second does not see content or actions their single role does not allow.
5. **Given** a signed-in person, **When** they try a feature or action their combined permissions do not allow, **Then** they are refused.
6. **Given** a person’s combined permissions include the permission to view sensitive financial fields, **When** they view content that includes those fields, **Then** cost, margin, and other sensitive financial fields are visible.
7. **Given** a person’s combined permissions do not include that permission, **When** they view the same kind of content, **Then** those fields are not visible.

---

### User Story 4 - Organization-based entry (Priority: P1)

A person with a valid organizational Microsoft account who has never been invited can still enter the application. They are not blocked at sign-in. If they have no roles, they see pending access and appear in User Management as someone waiting for a role. Personal Microsoft accounts remain refused.

**Why this priority**: Organization membership remains a valid way in. Invite must not replace or block the previous authentication feature’s organization-based entry.

**Independent Test**: Sign in with a valid organizational Microsoft account that was never invited. Confirm the person enters, sees pending access when they have no roles, and appears in User Management as waiting for a role. Confirm a personal Microsoft account is still refused.

**Acceptance Scenarios**:

1. **Given** a valid organizational Microsoft account that has never been invited, **When** that person completes Microsoft sign-in, **Then** they enter the application.
2. **Given** that person has no roles, **When** they use the application, **Then** they see pending access only and cannot open the combined landing or User Management.
3. **Given** a person with access-administration opens User Management, **When** they review people, **Then** they see that organization-based signer as a person waiting for a role.
4. **Given** a personal Microsoft account, **When** that person tries to sign in, **Then** they are still refused (unchanged from the previous authentication feature).

---

### User Story 5 - Assign and revoke multiple roles (Priority: P1)

From User Management, a person with access-administration assigns an existing role to a person (invited or organization-entered) without replacing roles that person already has, and revokes one assigned role at a time. The same role cannot be assigned twice. If other roles remain after a revoke, the person keeps the remaining combined permissions. If none remain, they see pending access on their next use. The organization cannot be left with zero people whose combined permissions include access-administration.

**Why this priority**: Multiple roles per person is a core rule. Assignment and revoke must work for both entry paths.

**Independent Test**: Invite a person, assign two different roles, revoke one, attempt a duplicate assign, and confirm the last person with access-administration cannot have that access removed. Repeat assign and revoke for a person who entered through the organization.

**Acceptance Scenarios**:

1. **Given** a person has no roles (invited or organization-entered), **When** someone with access-administration assigns an existing role, **Then** that role is added and the person’s next use follows that role’s permissions.
2. **Given** a person already has one or more roles, **When** someone with access-administration assigns a different existing role, **Then** the new role is added and every previously assigned role stays.
3. **Given** a person already has a role, **When** someone with access-administration assigns that same role again, **Then** the assignment is refused or has no effect and the person does not hold a duplicate of that role.
4. **Given** a person has more than one role, **When** someone with access-administration revokes one of those roles, **Then** the remaining roles stay assigned and the person’s next use follows the remaining combined permissions.
5. **Given** a person has exactly one role, **When** someone with access-administration revokes that role, **Then** the person has no roles and sees pending access on their next use (they remain listed as a person).
6. **Given** only one person remains whose combined permissions include access-administration, **When** someone tries to revoke the role that provides that permission (even if that person has other roles), **Then** the change is refused and at least one person with access-administration remains.
7. **Given** a person’s combined permissions do not include access-administration, **When** they try to assign or revoke roles, **Then** they are refused.

---

### User Story 6 - Create and edit roles (Priority: P1)

From User Management, a person with access-administration creates a new role, changes its name or description, and attaches or detaches existing permissions. A role may hold many permissions. Authorization follows the permissions attached to a person’s assigned roles, not the role’s display name. Creating, renaming, or deleting permission types is not available.

**Why this priority**: Roles must be manageable as data so assignments are not limited to a fixed named set. Without attachable existing permissions, new roles cannot grant any action.

**Independent Test**: Create a role, attach two existing permissions, assign it to a person, detach one permission, and confirm the person’s next use follows the remaining attached permissions. Confirm permission types cannot be created.

**Acceptance Scenarios**:

1. **Given** User Management is open, **When** a person with access-administration creates a role with a name and optional description, **Then** that role exists and can be assigned and can have existing permissions attached.
2. **Given** an existing role, **When** a person with access-administration changes its name or description, **Then** the updated name is what people see on the combined landing and in User Management.
3. **Given** an existing role and existing permissions, **When** a person with access-administration attaches more than one permission to that role, **Then** the role holds all of those permissions.
4. **Given** a role already has a permission, **When** someone attaches that same permission again, **Then** the change is refused or has no effect and the role does not hold a duplicate of that permission.
5. **Given** a role has more than one permission, **When** a person with access-administration detaches one permission, **Then** the remaining permissions stay on the role and every person assigned that role uses the updated combined permissions on their next use.
6. **Given** a person’s combined permissions do not include access-administration, **When** they try to create or edit roles or attach or detach permissions, **Then** they are refused.
7. **Given** User Management is open, **When** a person looks for a way to create a new permission type, **Then** that action is not offered.

---

### User Story 7 - Delete a role (Priority: P2)

A person with access-administration deletes a role that nobody is assigned. Deletion is refused while anyone still has that role. Deletion is also refused if removing the role would leave the organization with zero people whose combined permissions include access-administration.

**Why this priority**: Unused roles should be removable, but not at the cost of assigned people or the last access-administration path. Invite, organization-based entry, and assignment can ship without delete.

**Independent Test**: Create a role, assign it, attempt delete (refused), revoke the assignment, delete the unused role (succeeds). Attempt a delete that would remove the last access-administration path and confirm it is refused.

**Acceptance Scenarios**:

1. **Given** a role that no person is assigned, **When** a person with access-administration deletes it, **Then** the role is gone and can no longer be assigned.
2. **Given** at least one person is assigned a role, **When** someone tries to delete that role, **Then** the delete is refused and a clear message explains that the role is still assigned.
3. **Given** deleting a role would leave zero people whose combined permissions include access-administration, **When** someone tries to delete it, **Then** the change is refused and at least one person with access-administration remains.
4. **Given** a person’s combined permissions do not include access-administration, **When** they try to delete a role, **Then** they are refused.

---

### User Story 8 - Cancel invite or remove a person (Priority: P2)

A person with access-administration cancels an invite that has not been used to sign in, or removes a person who already signed in (whether they were invited or entered through the organization). After cancel, that unused invite is gone from the list. After remove, the person leaves the list and loses their roles. Neither action blocks later organization-based entry: a valid organizational Microsoft account may still sign in and, with no roles, see pending access. The organization cannot be left with zero people whose combined permissions include access-administration.

**Why this priority**: Admins need a way to take back an unused invite and to remove a signed-in person. Assignment and both entry paths can be demonstrated without this, so it follows the first-wave stories.

**Independent Test**: Cancel an unused invite and confirm that email may still sign in through the organization and see pending access. Remove a signed-in person (when they are not the last access-administration grant) and confirm they leave the list; if they sign in again through the organization they see pending access. Confirm a cancelled or removed email can be invited again.

**Acceptance Scenarios**:

1. **Given** a person was invited and has not signed in, **When** someone with access-administration cancels that invite, **Then** the person is no longer listed as invited.
2. **Given** that unused invite was cancelled, **When** the same organizational Microsoft account signs in, **Then** they enter through the organization, see pending access if they have no roles, and appear in User Management as waiting for a role.
3. **Given** a person has signed in (invited or organization-entered), **When** someone with access-administration removes them, **Then** they no longer appear as a listed person and they have no roles.
4. **Given** that person was removed, **When** they sign in again with the same organizational Microsoft account, **Then** they enter through the organization, see pending access, and appear again as waiting for a role.
5. **Given** a cancelled or removed email is invited again later, **When** a person with access-administration invites that email, **Then** a new invite is allowed.
6. **Given** removing a person would leave zero people whose combined permissions include access-administration, **When** someone tries to remove them, **Then** the change is refused and at least one person with access-administration remains.
7. **Given** a person’s combined permissions do not include access-administration, **When** they try to cancel an invite or remove a person, **Then** they are refused.

---

### Edge Cases

- The designated initial Microsoft identity signs in without a prior invite, receives a role that already includes access-administration, and can then invite others. Other organizational accounts may also sign in without an invite; they see pending access until assigned a role.
- The designated initial identity is missing or does not match the signed-in person: that person is treated as an ordinary organization-based signer (pending access if they have no roles, or their assigned roles if they have any).
- Microsoft sign-in succeeds for an accepted organizational account that has never been invited: the person enters and is not blocked. With no roles they see pending access and appear in User Management.
- Invite email matching on sign-in is case-insensitive.
- A personal Microsoft account is refused and is not invited or pending.
- A signed-in person with no roles (invited or organization-entered) sees pending access only; they remain listed as a person.
- Cancel of an unused invite does not prevent later organization-based sign-in by that email.
- Remove of a signed-in person does not prevent later organization-based sign-in; they return as pending until assigned roles again. This feature does not offer a permanent block of a specific organizational account.
- Roles or permissions on a person or role change while they are using the application: their next use follows the updated combined permissions; they must not keep seeing content or actions the new set does not allow.
- Detaching a permission from a role that several people share updates all of those people on their next use.
- Assigning a role the person already has is refused or has no effect; the person does not hold a duplicate of that role.
- Attaching a permission a role already has is refused or has no effect; the role does not hold a duplicate of that permission.
- Creating a role with a name that another role already uses is refused.
- Someone tries to revoke, detach, delete, or remove in a way that would leave zero people with access-administration: the change is refused and a clear message explains that at least one person with access-administration must remain.
- A person with access-administration assigns additional roles to themselves: they keep every previously assigned role plus the new ones.
- The previous access-administration screen is no longer a separate home; Settings → User Management is where people and roles are managed.
- Secrets and the designated initial Microsoft identity are not stored in project source.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: FlyAccounts MUST provide Settings → User Management as the place to invite people, review people who entered through the organization, assign and revoke roles, and create, edit, and delete roles (including attaching and detaching existing permissions).
- **FR-002**: Only a person whose combined permissions include access-administration MUST be able to open User Management or perform any User Management action. The application MUST refuse those actions when that permission is absent, not only by hiding the screen.
- **FR-003**: A person MAY be invited with an organizational work email before they sign in. A valid organizational Microsoft account MUST be allowed to sign in without an invite. The designated initial Microsoft identity MUST still receive a role that already includes access-administration so they can invite others.
- **FR-004**: An invite MUST allow assigning zero or more existing roles at invite time. Assigned roles MUST be added without requiring the invited person to have signed in first.
- **FR-005**: Inviting an email that already has an active invite or that already belongs to a listed person (invited or organization-entered) MUST be refused.
- **FR-006**: A valid organizational Microsoft sign-in whose email does not match an invite (case-insensitive) MUST succeed. If that person has no roles, they MUST see pending access and MUST be listed in User Management as waiting for a role.
- **FR-007**: After a person signs in (invited or through the organization), they MUST use the application only as the combined permissions of all assigned roles allow. With no roles, they MUST see pending access only.
- **FR-008**: A person MAY have multiple roles at the same time. Assigning a role MUST add it and MUST NOT replace roles the person already has. Assigning a role the person already has MUST NOT create a duplicate.
- **FR-009**: A person with access-administration MUST be able to revoke one assigned role. If other roles remain, those roles MUST stay assigned. If none remain, the person MUST have no roles, MUST remain listed, and MUST see pending access on their next use.
- **FR-010**: The application MUST refuse any change (revoke, detach, delete role, cancel, or remove) that would leave the organization with zero people whose combined permissions include access-administration.
- **FR-011**: A role MAY have multiple existing permissions. Attaching a permission MUST add it. Attaching a permission the role already has MUST NOT create a duplicate. Detaching a permission MUST leave the remaining permissions on the role.
- **FR-012**: A person with access-administration MUST be able to create a role (name required, description optional), change its name or description, and attach or detach existing permissions. Role names MUST be unique.
- **FR-013**: A person with access-administration MUST be able to delete a role only when no person is assigned that role. Delete MUST be refused while the role is assigned.
- **FR-014**: This feature MUST NOT offer creating, renaming, or deleting permission types. Permissions remain existing named capabilities that roles can attach.
- **FR-015**: Every feature and action in the application MUST be allowed only when the actor’s combined permissions include the permission for that feature or action. Combined permissions are the union of permissions from all assigned roles. Authorization MUST be enforced where data is provided, not only by hiding controls.
- **FR-016**: Cost, margin, and other sensitive financial fields MUST be visible only when the combined permissions include the permission to view sensitive financial fields.
- **FR-017**: When roles, assignments, or a role’s permissions change, the application MUST apply the updated combined permissions on the person’s next use and MUST NOT continue serving content or actions the new set does not allow.
- **FR-018**: A person with access-administration MUST be able to cancel an unused invite and MUST be able to remove a listed person who has signed in. After cancel, that unused invite MUST no longer appear. After remove, that person MUST no longer appear and MUST have no roles. Cancel and remove MUST NOT prevent a later organization-based sign-in by the same account; that sign-in MUST succeed and, with no roles, MUST show pending access and MUST list the person again as waiting for a role.
- **FR-019**: The designated initial Microsoft identity MUST be supplied by environment configuration, not by project source. That identity MAY sign in without a prior invite and MUST receive a role that already includes access-administration so they can invite others.
- **FR-020**: Settings, User Management, invite, assignment, and role-management screens MUST be readable and usable on phone, tablet, and desktop, and MUST be usable with a keyboard.
- **FR-021**: The previous standalone access-administration home MUST be replaced by Settings → User Management. The combined landing MUST still list every assigned role’s name and show only what the combined permissions allow.
- **FR-022**: Personal Microsoft accounts MUST remain rejected. The application MUST NOT offer a dummy, bypass, or local-password sign-in path. Secrets and the designated initial Microsoft identity MUST NOT be stored in project source.

### Key Entities

- **User**: A person identified by organizational work email and, after sign-in, by their organizational Microsoft account. They may be invited before first sign-in, or they may enter through the organization without an invite. Key attributes: work email, display name after sign-in, whether they have signed in, how they entered (invite or organization), assigned roles.
- **Invite**: An optional pre-provision record for an organizational email that has not signed in yet. Created by a person with access-administration. May include zero or more roles. Cancelled invites are removed from the list and do not block later organization-based sign-in.
- **Role**: A named grouping of permissions. Created and edited in User Management. Display name is a label; access follows attached permissions, not the name.
- **Permission**: An existing named capability that can be attached to roles (including access-administration and view sensitive financial fields). This feature does not create or edit permission types.
- **Role Assignment**: The link between a User and one or more Roles. Created at invite time or later. The same role is not assigned twice to the same person.
- **Role Permission**: The link between a Role and one or more existing Permissions. The same permission is not attached twice to the same role.
- **Settings**: The application area that contains User Management (people and roles together).
- **Pending Access**: The state shown when a signed-in person (invited or organization-entered) has no roles.
- **Authorized Landing**: The single combined home shown after sign-in when the person has one or more roles. It lists every assigned role’s name and shows only what the combined permissions allow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a supervised walkthrough, 100% of testers with access-administration open Settings → User Management and complete an invite (with and without roles) within 3 minutes of starting the task.
- **SC-002**: 100% of invited testers who sign in with the matching organizational account reach either pending access (no roles) or their combined landing (one or more roles) within 60 seconds of starting sign-in.
- **SC-003**: 100% of uninvited organizational testers sign in, reach pending access when they have no roles, and appear in User Management as waiting for a role. 0% of those testers are refused at sign-in.
- **SC-004**: A tester with two roles that have different permissions (assigned on invite or after organization-based entry) sees both role names and the union of allowed content and actions, and 0% of that walkthrough shows content or actions outside that union.
- **SC-005**: Testers observe cost and margin if and only if the combined permissions include the permission to view sensitive financial fields (including when that permission comes from only one of several assigned roles).
- **SC-006**: 100% of attempts to assign a duplicate role, invite a duplicate email (including an email that already belongs to a listed person), delete a role that is still assigned, or remove the last remaining access-administration grant fail with a clear refusal, and at least one person with access-administration remains.
- **SC-007**: After a role’s permissions are changed or a person’s roles are changed, 100% of the next uses by affected testers follow the new combined permissions and 0% continue to show previously allowed content that the new set does not allow.
- **SC-008**: Testers with access-administration can create a role, attach at least two existing permissions, assign it, and later delete it only after no one is assigned it, in 100% of supervised trials. 0% of testers find a way to create a new permission type.
- **SC-009**: After an unused invite is cancelled, or a signed-in person is removed (when they are not the last access-administration grant), 100% of those organizational accounts can sign in again through the organization, reach pending access, and appear in User Management as waiting for a role. 0% of those accounts are blocked at sign-in because of the cancel or remove.
- **SC-010**: On phone, tablet, and desktop widths, testers with access-administration can open Settings → User Management, invite a person, assign a role, and create a role without horizontal cramming, using a keyboard for the same tasks.
- **SC-011**: Reviewers find 0 dummy or bypass sign-in paths and 0 committed secrets or committed initial-identity values. 0% of testers without access-administration can open User Management or complete an invite, assignment, or role change.

## Assumptions

- Microsoft proves identity only. FlyAccounts decides what a signed-in person may do (combined permissions of assigned roles). Who may enter is any accepted organizational Microsoft account, with invite as an optional pre-provision path.
- Combined permissions means the union of permissions from all assigned roles. A permission is granted if any assigned role includes it.
- Role names are labels. Authorization checks permissions, not role display names.
- Invite is an in-app record keyed by organizational work email. Sending an email message is not required in this feature.
- Invite does not require the person to have signed in first.
- Only organizational Microsoft work or school accounts are accepted. Personal Microsoft accounts remain out of scope.
- The designated initial Microsoft identity from the previous authentication feature may sign in without a prior invite so the first person can invite others. That identity is supplied by environment configuration, not project source. Other organizational accounts may also sign in without an invite.
- Permissions already exist as named capabilities (including access-administration and view sensitive financial fields). This feature attaches those existing permissions to roles. New permission types for later modules are added as data by those modules, not by a permission-type editor here.
- Access-administration in this feature is application-wide. Legal-entity switching (Entity A, Entity B, Entity C, or All Entities Consolidated) is specified in a later feature.
- Standing field policy: cost, margin, and other sensitive financial fields are visible only when the combined permissions include the permission to view sensitive financial fields.
- Deleting a role that is still assigned is refused. The role must have no assignments before it can be deleted.
- This feature adds invite as an additional entry path. It does not revoke the previous authentication feature’s rule that an accepted organizational account may sign in and wait on pending access. Pending access is for any signed-in person with no roles.
- Cancel and remove clear the unused invite or the listed person. They do not create a permanent block. A later organization-based sign-in is allowed.
- The combined landing remains the authorized home after sign-in when the person has roles. User Management is reached from Settings, not as a replacement for that landing.
- Later modules MUST honor combined permissions for every feature and action they add. Those modules are not built in this feature.
- Delivery remains one backend and one frontend bound by a published contract, per the project constitution.

## Out of Scope

The following MUST NOT be delivered in this feature:

- Creating, renaming, or deleting permission types
- Sending invitation email or other outbound messages
- A permanent denylist or block of a specific organizational account (beyond cancel or remove, which do not prevent later organization-based sign-in)
- Legal-entity switching and the consolidated read-only view
- Contract Management, Resource Allocation, invoicing, payments, ledgers, reporting, tax, ZATCA, and other business modules beyond permission checks and the standing field policy already specified
- Personal Microsoft accounts
- Self-service invite request or approval workflows
- Local username and password, or any dummy or bypass sign-in
- In-app management of Microsoft directory accounts
