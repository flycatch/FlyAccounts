# Feature Specification: Proforma Module (list + dual-entry create + PDF)

**Feature Branch**: `008-proforma-module`

**Created**: 2026-08-21

**Status**: Draft

**Input**: Entity-scoped Proformas list and dual-entry create (from contract or independent); branded PDF download; FlyAccounts favicon; no statutory tax at proforma stage.

## Clarifications

### Session 2026-08-21

- Q: Convert to Tax Invoice? → A: Button enabled only for Approved; shows “Coming soon” (no tax invoice record).
- Q: Permission? → A: New `manage_proformas` (seeded; System Admin). Money redaction still uses `view_contract_financials`.
- Q: Download? → A: After create and on list rows: branded PDF with Flycatch logo; NOT TAX-VALID banner; no GST/ZATCA.
- Q: Speckit artifacts? → A: Only `spec.md` for this feature. OpenAPI lives in the committed 005 contracts file (v8.0.0).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse proformas (Priority: P1)

A person with `manage_proformas` opens Proformas from the sidebar, sees Entity Switcher context, and a table of Proforma ID, Contract Ref, Client Name, Entity, Amount, Currency, Valid Until, Status. Amount is hidden without `view_contract_financials`.

**Acceptance Scenarios**:

1. **Given** `manage_proformas`, **When** they open Proformas, **Then** the list loads for the active entity (or All Entities consolidated).
2. **Given** All Entities is selected, **When** they try New Proforma, **Then** the button is disabled and create is refused with `entity_context_required`.
3. **Given** a caller lacks `view_contract_financials`, **When** they list, **Then** `estimatedAmount` is omitted.

---

### User Story 2 - Dual-entry create (Priority: P1)

**Flow A:** From Contract Details, **Create Proforma** navigates to `/proformas/new?contractId=…` with CONTRACT locked and CURRENCY, ESTIMATED AMOUNT, and Client (Name, Address, VAT, Email) prefilled.

**Flow B:** `/proformas/new` with an active CONTRACT dropdown; selecting a contract refills the same fields.

Create screen shows title **New Proforma**, badge **NOT TAX-VALID - FOR APPROVAL ONLY**, Entity Switcher in the shell header, VALID UNTIL date, and status pills Draft / Shared w/ Client / Approved.

**Acceptance Scenarios**:

1. **Given** a contract with a client, **When** Flow A opens, **Then** contract is locked and client fields match the client master.
2. **Given** Flow B, **When** a contract is selected, **Then** currency and client fields update.
3. **Given** a valid form and a single entity, **When** they save, **Then** a proforma is created with a sequential code (e.g. `PF-0001`) and appears in the list.

---

### User Story 3 - Download proforma PDF (Priority: P1)

After create (and from the list), the person downloads a branded PDF with the Flycatch logo, entity name, proforma code, client snapshot, contract ref, amount (or Restricted), currency, valid until, status, and a footer that this is not a tax invoice and no GST/ZATCA is calculated.

**Acceptance Scenarios**:

1. **Given** a proforma exists, **When** they download PDF, **Then** the response is `application/pdf` starting with `%PDF`.
2. **Given** no `view_contract_financials`, **When** they download, **Then** the amount is Restricted and no tax lines appear.

---

### User Story 4 - Convert stub (Priority: P2)

List row **Convert to Tax Invoice** is enabled only when status is Approved; click shows Coming soon.

## Non-goals

- Tax invoice records / GST / ZATCA
- Emailing the PDF
- Proforma edit / delete
- Hotlinking favicon from flycatchtech.com at runtime

## Success Criteria

- Favicon and sidebar brand use vendored Flycatch assets.
- OpenAPI 8.0.0 is SSOT; frontend types generated from it.
- `manage_proformas` gates list/create/download/nav.
- No statutory tax on proforma create or PDF.
- Resource cost / margin never appear on proforma screens.
