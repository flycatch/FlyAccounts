# Research: Contracts Module

## Decision: Entity context via `X-Entity-Id`

- **Decision**: Clients send `X-Entity-Id` as a legal entity UUID, `*` for All Entities, or omit for All Entities.
- **Rationale**: Matches constitution (no Entity form field) and keeps list/create scoped server-side.
- **Alternatives considered**: Query `?entityId=` (weaker for writes); path prefix (more routing churn).

## Decision: JSON create + prior file upload

- **Decision**: `POST /contracts/files` stores `.pdf`/`.docx` and returns `fileKey`; `POST /contracts` accepts JSON including `clientFileKey`.
- **Rationale**: Simpler OpenAPI typing than full multipart wizard payloads; reuses S3 helper.
- **Alternatives considered**: Single multipart create (harder schema + client generation).

## Decision: Money as decimal strings + permission gate

- **Decision**: Store monetary columns as strings; omit from responses without `view_contract_financials`.
- **Rationale**: Constitution forbids float money; HR must not see cost/value/rates.
- **Alternatives considered**: Numeric DB types with client formatting (still need string wire format).

## Decision: Soft-delete and audit deferred

- **Decision**: No `deleted_at` or audit tables in this migration.
- **Rationale**: Locked MVP scope; avoids unused schema.

## Decision: Permission seeds on System Admin + test roles

- **Decision**: Seed `manage_contracts` and `view_contract_financials`; attach both to System Admin. Tests create an HR-style role with only `manage_contracts`.
- **Rationale**: Keeps production seed small while enabling RBAC tests.
