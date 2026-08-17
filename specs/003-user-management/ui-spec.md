# UI Specification: Settings User Management

Visual chrome and tokens extracted from [Sinoj P M's team library](https://www.figma.com/design/awAgrgh2DLTC9a3pxlPabe/Sinoj-P-M-s-team-library?node-id=4311-2) frame **Billing And Invoice** (`4311:10`), page `4311:2`. Named variables from `get_variable_defs` on that frame.

This file is a **validation and implementation reference**, not application code. Do **not** port invoice, billing, Workspace, Pipeline, Communication, or Account screens. Map the Figma Settings group (Account / Users / Billing and Invoice) to FlyAccounts **Users / Roles / Permissions**.

Ordinary CSS variables at implementation. No Tailwind. No large UI kit (constitution XVI).

## Information architecture

```text
[Sidebar 223px]                         [Main #FAFAFA]
 FlyAccounts (brand, 24px icon + 18px)
 Home          → combined landing
 Settings      (group label; access_administration only)
   Users       → people + invites, invite form, assign/revoke, cancel/remove
   Roles       → create/edit/delete roles, attach/detach existing permissions
   Permissions → read-only catalog grouped by module
```

- Combined landing remains the authorized home after sign-in when the person has roles (FR-021).
- Settings is omitted for pending access and for people whose combined permissions lack `access_administration`.
- Direct navigation to Settings without that permission stays on combined landing or pending access; APIs return 403.
- Phone/tablet: sidebar collapses; Settings items become stacked nav (FR-020). Keyboard-usable.
- Do not add Workspace, Pipeline, Communication, Account, or Billing and Invoice to FlyAccounts.

### Nav states

| State | Fill | Type |
|-------|------|------|
| Group label (Settings) | none | Work Sans SemiBold 12px `#2C2C2C` |
| Item default | none | Work Sans Medium 12px `#2C2C2C` |
| Item active | `rgba(91, 137, 255, 0.1)` | Work Sans SemiBold 12px `#2C2C2C` |

Nav item: height 40px, padding 12px 24px, radius 4px.

### Users status chips (reuse Figma pill language)

| Person status | Chip (map from Figma Paid / Pending) |
|---------------|--------------------------------------|
| `active` | paid: text `#07A104`, fill `#E1FFDC` |
| `pending` | pending: text `#E2B102`, fill `#FFF5DC` |
| `invited` | pending chip, label “Invited” |

Use Work Sans for all chip labels (Figma Pending uses Nunito; FlyAccounts stays on Work Sans).

## Named Figma variables (node 4311:10)

| Token | Hex | CSS variable (implementation) |
|-------|-----|-------------------------------|
| Primary | `#5B89FF` | `--color-primary` |
| Secondary | `#5B89FF` | `--color-secondary` |
| Black | `#2C2C2C` | `--color-black` |
| Text | `#030229` | `--color-text` |
| Sub text | `#696969` | `--color-subtext` |
| Box color | `#F8F8F8` | `--color-box` |
| Stroke | `#ECECEC` | `--color-stroke` |

Body copy uses Black (`#2C2C2C`). Named Text (`#030229`) is reserved if a denser ink is needed; do not mix both on the same text role.

## Additional paints in the frame

| Role | Value |
|------|--------|
| Page background | `#FAFAFA` (`--color-page`) |
| Surface / sidebar / card body / table row | `#FFFFFF` (`--color-surface`) |
| Progress track | `#EAEAEA` (`--color-track`) |
| Nav active fill | `rgba(91, 137, 255, 0.1)` (`--color-nav-active`) |
| Status paid text | `#07A104` (`--color-status-paid`) |
| Status paid fill | `#E1FFDC` (`--color-status-paid-bg`) |
| Status pending text | `#E2B102` (`--color-status-pending`) |
| Status pending fill | `#FFF5DC` (`--color-status-pending-bg`) |

## Typography

Load **Plus Jakarta Sans** and **Work Sans** from Google Fonts at implementation.

| Role | Family | Weight | Size |
|------|--------|--------|------|
| Page title | Plus Jakarta Sans | SemiBold | 16px |
| Page subtitle | Plus Jakarta Sans | Medium | 10px, Sub text |
| Card title | Plus Jakarta Sans | SemiBold | 14px |
| Eyebrow / field label | Plus Jakarta Sans | Medium | 8px, uppercase, Sub text |
| Primary button | Plus Jakarta Sans | Bold | 10px, white |
| Brand (sidebar) | Work Sans | Medium | 18px, Black |
| Nav group | Work Sans | SemiBold | 12px |
| Nav item / table header | Work Sans | Medium | 12px; headers at 70% opacity, Sub text |
| Body / table cell | Work Sans | Regular | 14px, Black |
| Secondary button | Work Sans | Medium | 12px, Sub text |

## Spacing, sizing, borders, shadows

| Measure | Value |
|---------|--------|
| Canvas (reference) | 1440×900 |
| Sidebar width | 223px |
| Content width (reference) | 970px |
| Content top offset | 26px |
| Content left (sidebar + gap) | ~247px (~24px gutter) |
| Sidebar inner | left 13px, top 26px |
| Brand icon-to-label gap | 8px |
| Nav section stack gap | 9px |
| Group label to items | -6px overlap (Figma); use 0–6px in CSS without clipping |
| Major section gap | 38px |
| Title to content | 22px |
| Card-to-card | 18px |
| Table header to rows | 16px |
| Table row gap | 12px |
| Card header height | 47px |
| Card inner padding | 16–18px |
| Table row height | 59px |
| Table row horizontal inset | 20px |
| Nav item | 40px height, padding 12×24, radius 4px |
| Border | 0.8px solid Stroke `#ECECEC` |
| Radius buttons/cards/progress | 4px |
| Radius table row | 10px |
| Radius status pill | 33px |
| Sidebar shadow | `0 4px 40px rgba(207, 207, 207, 0.07)` |
| Card/row shadow | none (border only) |

Primary button padding: 8px 12px. Secondary/outline: white fill, 0.8px Stroke, same padding, height ~30px.

## Icons

Vuesax linear. Export from Figma at implementation; do not hand-draw SVG paths. MCP asset URLs expire in about seven days.

| Use | Node / name | Size |
|-----|-------------|------|
| Brand | `vuesax/linear/sms-tracking` | 24×24 |
| Inline email | `vuesax/linear/sms` | 12×12 |
| Table sort | Arrow Down 2 | 6×5 |
| Row action | three ellipses | 3px each |

FlyAccounts brand may keep the 24px slot with a FlyAccounts mark if one exists; otherwise use the exported tracking icon as in the file.

## Reusable components (chrome only)

- **App shell**: white sidebar (223px, shadow above) + `#FAFAFA` main
- **Nav group label** + **nav item** (default / active)
- **Page title + subtitle**
- **Primary button**: fill Primary, white Bold 10px, padding 8×12, radius 4px
- **Secondary button**: white, 0.8px Stroke, Sub text Medium 12px
- **Card**: `#F8F8F8` header bar (47px, top radius 4px, 0.8px Stroke) + white body (bottom radius 4px)
- **Data row**: white, 10px radius, 59px, Work Sans 14
- **Status chip**: pill 33px radius; paid/pending colors as above
- **Progress bar**: optional; not required for Settings (`#EAEAEA` track, Primary fill, 18px height, 4px radius)

## Mapping Figma → FlyAccounts screens

| Figma | FlyAccounts |
|-------|-------------|
| Email Outreach brand | FlyAccounts |
| Dashboard (Workspace) | Home → combined landing |
| Settings / Users | Settings → Users |
| Settings / Billing and Invoice (active style) | Active style for current Settings section |
| Settings / Account | Omit |
| Billing cards, invoice table content | Omit as product; reuse card + row + chip chrome on Users/Roles/Permissions |

Permissions is a read-only list grouped by `module` (no create control, no action editor). Rows with no `action` are whole-module grants. Roles uses primary button for create and secondary for cancel/delete confirmations.
