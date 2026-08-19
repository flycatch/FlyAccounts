# Data Model: Contracts Module

## legal_entities

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | Fixed seed UUIDs |
| code | string unique | `entity_a`, `entity_b`, `entity_c` |
| name | string | Entity A / B / C |
| allowed_currencies | JSON array | A/B: INR,USD; C: SAR,USD |
| active | boolean | default true |

## contracts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| entity_id | UUID FK → legal_entities | Required |
| reference | string | e.g. CTR-0133 |
| category | string | time_and_material / data_management / contract_staffing |
| currency | string | INR / USD / SAR |
| is_amendment | boolean | |
| parent_contract_id | UUID FK nullable | When amendment |
| closure_owner_user_id | UUID FK → users | |
| start_date | date | |
| end_date | date | Must be >= start_date |
| project_status | string | active / on_hold / support / cancelled |
| pmo_note | text nullable | |
| payment_type | string | project_value / monthly |
| project_value | string nullable | Decimal string |
| monthly_rate | string nullable | Decimal string |
| months | int nullable | |
| resource_type | string | inhouse / vendor |
| client_file_key | string | S3 object key |
| created_by_user_id | UUID FK → users | |
| created_at | timestamptz | |

No soft-delete column in this feature.

## contract_milestones

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| contract_id | UUID FK | |
| name | string | |
| value | string | Decimal string |
| due_condition_or_date | string | |
| sort_order | int | |

## contract_resources

One primary resource row per contract in MVP.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| contract_id | UUID FK | |
| mode | string | inhouse / vendor |
| resource_user_id | UUID nullable | |
| resource_name | string nullable | |
| allocation_percent | int nullable | 0–100 |
| cost_of_resource | string nullable | Decimal; redact without permission |
| vendor_contract_ref | string nullable | |
| vendor_contract_file_key | string nullable | |
| monthly_vendor_invoice | string nullable | |
| monthly_vendor_invoice_file_key | string nullable | |
| tds_paid_payable | string nullable | |
| gst_paid_payable | string nullable | |

## Permissions

| Code | Purpose |
|------|---------|
| manage_contracts | Nav, list, create, file upload |
| view_contract_financials | See money fields in list/create responses and UI |
