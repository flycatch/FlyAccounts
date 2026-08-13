# Quickstart: App Foundation

Everyday start instructions also live in the root [README.md](../../README.md). This file is the validation walkthrough.

Validate that FlyAccounts starts, shows a working page, and reports connection honestly. Implementation code belongs in a later phase; this guide is the runnable check against [spec.md](./spec.md), [data-model.md](./data-model.md), and [contracts/openapi.yaml](./contracts/openapi.yaml).

## Prerequisites

- Docker and Docker Compose
- A copy of this repository

## Setup

1. Copy the shared env template (do not commit the copy):

   ```bash
   cp deployment/.env.example deployment/.env
   ```

2. Start frontend, backend, PostgreSQL, and MinIO from the shared folder:

   ```bash
   docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build
   ```

   The backend applies the Alembic baseline on startup (or via a one-shot migrate step defined next to the backend service). There are no business tables in this stage.

3. Open the frontend URL published by Compose (see `deployment/.env.example` for the host port).

## Validation scenarios

### 1. Application is working (SC-001, SC-004, FR-003, FR-006)

- Within 10 seconds, the page states that the application is working.
- No accounting features appear (no legal entities, invoices, contracts, ledgers, payments, reports, tax, or similar).

### 2. Parts are connected (SC-002, FR-004)

With all four Compose services running:

- The page states that the application is connected successfully.
- After a successful `GET /v1/status` (see contract), database and storage both show reachable (`ok`).

Expected contract body:

```json
{ "service": "ok", "database": "ok", "storage": "ok" }
```

### 3. Backend stopped (SC-003, FR-005)

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml stop backend
```

Refresh the page:

- It states that the application is not connected.
- It MUST NOT show a connected-successfully message.
- Do not treat database or storage as `ok`.

Start the backend again and refresh: the page shows connected successfully.

### 4. PostgreSQL unavailable

With the backend running:

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml stop postgres
```

Refresh:

- Page shows connected successfully (frontend reached the backend).
- Database shows unavailable.
- Connection success MUST still appear; this is not the “backend down” case.

### 5. Storage unavailable

Restore Postgres, then break MinIO (stop the `minio` service or use invalid S3 credentials in a throwaway local `.env`). Refresh:

- Page shows connected successfully.
- Storage shows unavailable.

### 6. Readable on phone, tablet, and desktop (SC-005, FR-009)

Resize the browser (or use device widths) for phone, tablet, and desktop. Working and connection messages remain readable without horizontal cramming.

## Notes

- Secrets stay in `deployment/.env`, never in source.
- [contracts/openapi.yaml](./contracts/openapi.yaml) is the single source of truth. Frontend and backend talk only through `GET /v1/status` as defined there.
- Do not add Compose or `.env` files under `frontend/` or `backend/`.
