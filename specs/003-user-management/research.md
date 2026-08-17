# Research: Settings User Management

## Invite as a separate table (not a User with null oid)

**Decision**: Keep `User.microsoft_oid` required and unique. Add `Invite` and `InviteRole` for unused pre-provision rows. On successful `POST /v1/auth/microsoft`, after upserting the User by `oid`, match the ID token work email (`preferred_username` / `email`) **case-insensitively** to an active invite (`consumed_at` and `cancelled_at` null). On match: copy each InviteRole to RoleAssignment (skip if the User already has that role), set `User.entry_path` to `invite`, set `Invite.consumed_at`. If no invite matches and this sign-in created the User, set `entry_path` to `organization`. Existing 002 Users without `entry_path` stay null until a later backfill is unnecessary for authorization.

**Rationale**: FR-003, FR-006. An unused invite is not a Microsoft identity yet. Leaving `microsoft_oid` NOT NULL avoids a second unique-null identity path and keeps 002 upsert logic. Invite as data matches the spec Key Entity.

**Alternatives considered**: Nullable `microsoft_oid` on User for invites (one people table, but weakens the identity unique key and mixes pre-sign-in with signed-in); require invite before any sign-in (superseded by dual-entry clarification). Rejected.

## Dual entry and people list union

**Decision**: `GET /people` returns a **union** of signed-in Users and active Invites, discriminated by `personType` (`user` | `invite`). Invite rows use Invite.id; user rows use User.id. Status: `invited` (active invite), `pending` (User with zero roles), `active` (User with one or more roles). Email for users is `User.upn`. Duplicate invite of an email that already has an active invite or that matches a listed User.upn (case-insensitive) is 409 (`duplicate_invite` or `already_present`).

**Rationale**: FR-001, FR-005, US2, US4. One Users screen. Invite is optional; organization-based signers appear as pending without being invited.

**Alternatives considered**: Two lists (invites vs users) (worse IA); refuse uninvited org sign-in (superseded). Rejected.

## Initial admin after invite consume

**Decision**: After invite consume, if the signer’s combined permissions still lack `access_administration` and their work email matches `INITIAL_ADMIN_EMAIL` (trim, case-insensitive, `preferred_username` and `email` claims), assign the seeded role that already includes that permission. Do **not** skip bootstrap merely because an invite already attached other roles. Do not re-assign if they already have the permission.

**Rationale**: FR-003, FR-019. The designated initial identity must be able to open Settings even if someone invited them with only Finance/HR/PMO.

**Alternatives considered**: Keep 002 “skip if any RoleAssignment exists” (fails when invite attached non-admin roles). Rejected.

## Last-admin counts signed-in Users only

**Decision**: Last-admin checks count Users whose combined permissions include `access_administration`. Unused invites, even with that permission pre-assigned, do not count (they cannot open Settings). Refuse revoke, detach, delete role, or remove person when the change would leave zero such Users (`last_admin_required`). Cancel of an unused invite is not a last-admin case.

**Rationale**: FR-010. Access-administration is a usable grant, not a pending invite.

**Alternatives considered**: Count invites with the admin role (would allow removing the only signed-in admin if an unused invite existed). Rejected.

## Role CRUD; permissions read-only

**Decision**: Admins create, rename (unique name), describe, attach, detach, and delete roles. Delete is refused while any User **or** active Invite still has the role (`role_still_assigned`), and when last-admin would fail. `GET /permissions` lists existing permission rows grouped by `module`. No POST/PATCH/DELETE on permission types (FR-014). Authorization still checks permission **codes**, never role display names or module strings.

**Rationale**: US6, US7, FR-011–FR-014. Seeded 002 permission **codes** remain the catalog. Module/action metadata is additive (see below).

**Alternatives considered**: Permission-type editor (out of spec); keep roles seed-only (002) (does not satisfy US6). Rejected.

## Module-level permissions; granular later

**Decision**: Permissions are **module-level** for this feature. Alembic `0003_user_management` adds `permissions.module` (required string, not a closed enum) and `permissions.action` (nullable string). **Null `action` means a whole-module grant.** Later features add more specific rows on the same table (e.g. `action` `create` or `view`); they MUST NOT introduce a second permission system. Authorization checks **exact `code` values** in the combined set. A module-level grant does **not** imply future child codes (no prefix inheritance). Keep 002 codes so `GET /me` `permissions[]` stays compatible:

| code | module | action |
|------|--------|--------|
| `access_administration` | `settings` | null |
| `finance_landing` | `finance` | null |
| `hr_landing` | `hr` | null |
| `pmo_landing` | `pmo` | null |
| `view_sensitive_financial_fields` | `finance` | `view_sensitive_financial_fields` |

The sensitive-fields row is the one current non-null action; standing field policy remains a code check. Settings → Permissions is a read-only list grouped by `module`.

**Rationale**: Product constraint: module-level now, flexible enough for later granularity without rewriting authorization. Exact-code checks keep later `finance.invoices.create` from being implied by `finance_landing`.

**Alternatives considered**: Prefix inheritance (`finance*` grants all finance codes) (hides missing grants and is hard to revoke one action); a separate granular ACL table (second model, constitution VI); renaming 002 codes (breaks `GET /me`). Rejected.

## Settings IA: three sidebar sections

**Decision**: Replace `AccessAdminPage` with a sidebar **Settings** group: **Users**, **Roles**, **Permissions**. Combined landing remains the authorized home (Home). Settings is visible only when `access_administration` is in combined permissions; every Settings API still 403 without it. Pending-access users see no Settings. Do not port Figma Workspace, Pipeline, Communication, Account, or Billing and Invoice items.

**Rationale**: User overlay on FR-001 / FR-021 and [ui-spec.md](./ui-spec.md). Figma Settings group is Account / Users / Billing; FlyAccounts maps that chrome to Users / Roles / Permissions.

**Alternatives considered**: One “User Management” page (spec wording; weaker match to requested IA); nested router library (unnecessary; view state or lightweight routes are enough). Rejected.

## Figma as chrome, ordinary CSS

**Decision**: Use extracted tokens from [Sinoj P M's team library](https://www.figma.com/design/awAgrgh2DLTC9a3pxlPabe/Sinoj-P-M-s-team-library?node-id=4311-2) frame `4311:10` as CSS variables. Plus Jakarta Sans + Work Sans from Google Fonts. No Tailwind. No large UI kit. Do not implement billing/invoice screens. Download Vuesax icon assets at implementation (MCP asset URLs expire).

**Rationale**: Constitution XVI; user instruction to extract, not implement, those screens. Details in [ui-spec.md](./ui-spec.md).

**Alternatives considered**: Tailwind (conflicts with XVI and 002 ordinary CSS); port the invoice table as Users (wrong domain). Rejected.

## CORS PATCH

**Decision**: CORS `allow_methods` become GET, POST, PATCH, DELETE. Role name/description updates use PATCH `/roles/{roleId}`. `allow_credentials` stays false.

**Rationale**: 002 allowed GET, POST, DELETE only. Role edit needs PATCH without inventing a POST-for-update.

**Alternatives considered**: POST `/roles/{roleId}` for updates (non-idiomatic); PUT full replace (forces sending every field). Rejected.

## Assign roles to unused invites

**Decision**: `POST/DELETE /people/invites/{inviteId}/roles` mirrors user assign/revoke so an invited person can receive roles before sign-in (US5). Duplicate InviteRole is 409 `duplicate_assignment`.

**Rationale**: Spec allows assigning existing roles to invited people who have not signed in.

**Alternatives considered**: Roles only at invite-create time (cannot add a role later without cancel+re-invite). Rejected.

## Pagination deferred

**Decision**: People, roles, and permissions lists remain unbounded in this feature. Organization-scale lists are expected. Add pagination in a later feature if lists grow.

**Rationale**: Constitution VIII; VI simplicity. Same as 002 people list.

**Alternatives considered**: Cursor pagination now (extra contract without a stated scale). Rejected.
