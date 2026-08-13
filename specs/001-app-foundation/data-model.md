# Data Model: App Foundation

This stage persists no business records. PostgreSQL is present and migrated; S3-compatible storage is configured. Entities below are runtime concepts used by the confirmation page and `GET /v1/status`. The on-the-wire shape in [contracts/openapi.yaml](./contracts/openapi.yaml) is the single source of truth; this file does not define a second schema.

## Entities

### FrontendApplication

The part a person opens in a browser. Serves one confirmation page. Does not store data. Does not share source or a database with the backend. Consumes `GET /v1/status` only through a client generated from [contracts/openapi.yaml](./contracts/openapi.yaml).

| Field | Type | Rules |
|-------|------|--------|
| Origin | URL | Served by the `frontend` Compose service |
| ApiBaseUrl | URL | From environment (`VITE_API_BASE_URL`); not committed as a secret-bearing value |

### BackendApplication

The part the frontend asks whether the system is reachable. Implements [contracts/openapi.yaml](./contracts/openapi.yaml) only. Reads PostgreSQL and S3 solely for reachability in this stage.

| Field | Type | Rules |
|-------|------|--------|
| Service | enum `ok` | Set when the process handled `GET /v1/status` |
| DatabaseUrl | connection string | From environment; never committed |
| StorageEndpoint | URL | From environment; S3-compatible |
| StorageBucket | string | From environment |

### ConnectionStatus

Result shown on the page for frontend-to-backend reachability (FR-004, FR-005). Derived; not stored.

| State | Meaning |
|-------|---------|
| `loading` | Page is open; no successful or failed status response yet |
| `connected` | `GET /v1/status` returned HTTP 200 |
| `not_connected` | Request failed (network, timeout, backend not running, or otherwise unreachable) |

**Transitions**

```text
loading → connected          # HTTP 200 from GET /v1/status
loading → not_connected      # request failed
connected → not_connected    # refresh or retry fails (backend stopped)
not_connected → connected    # refresh or retry succeeds (backend back)
```

**Validation**

- MUST NOT show connected-success while in `not_connected` or `loading`.
- `loading` MUST NOT be presented as connected successfully.
- Refresh after the backend returns MUST be allowed to move `not_connected` → `connected`.

### DatabaseReachability

Whether the backend could reach PostgreSQL. Derived from the status body. Shown only when ConnectionStatus is `connected`.

| State | Meaning |
|-------|---------|
| `ok` | Backend `SELECT 1` succeeded |
| `unavailable` | Backend could not reach PostgreSQL |

**Validation**: MUST NOT invent `ok` when ConnectionStatus is `not_connected`. MUST NOT change ConnectionStatus by itself (DB down still yields HTTP 200 and `connected` if the backend answered).

### StorageReachability

Whether the backend could reach the configured S3-compatible bucket. Derived from the status body. Shown only when ConnectionStatus is `connected`.

| State | Meaning |
|-------|---------|
| `ok` | Backend `HeadBucket` succeeded |
| `unavailable` | Backend could not reach storage |

**Validation**: Same as DatabaseReachability — no invented `ok` on a failed status request; storage failure does not redefine frontend-to-backend connection.

## Persistence

- **PostgreSQL**: Alembic-managed. This feature ships a baseline/empty revision only. No business tables, money columns, or entity keys.
- **S3-compatible storage**: Bucket configured for later features. This feature does not create objects.
- **Migrations**: Schema changes go through Alembic. Do not auto-rewrite the database on startup (constitution XV).
- **Money**: N/A this stage.

## Relationships

```text
FrontendApplication  --calls-->  BackendApplication
BackendApplication   --probes--> PostgreSQL (SELECT 1)
BackendApplication   --probes--> S3 bucket (HeadBucket)
ConnectionStatus     --derived from--> HTTP outcome of GET /v1/status
DatabaseReachability --derived from--> status body (only if connected)
StorageReachability  --derived from--> status body (only if connected)
```
