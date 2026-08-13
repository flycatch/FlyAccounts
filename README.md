# FlyAccounts

Foundation stage for FlyAccounts: a working-and-connected confirmation page. This stage has no accounting features (no entities, invoices, contracts, ledgers, payments, reports, or tax).

## Stack

- Frontend: React
- Backend: FastAPI
- Database: PostgreSQL
- File storage: S3-compatible (MinIO locally)

## Layout

- `frontend/` — the page a person opens
- `backend/` — the API that answers the status contract
- `deployment/` — shared Docker Compose and environment files

## Start

```bash
cp deployment/.env.example deployment/.env
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build
```

Open the frontend URL (default http://localhost:8080).

## What you should see

- The application is working
- Connected successfully when the frontend reaches `GET /v1/status`
- Database and storage reachability after that successful response

## Secrets

Never commit `deployment/.env`. Use `deployment/.env.example` as the template.

## Links

- Validation walkthrough: [specs/001-app-foundation/quickstart.md](specs/001-app-foundation/quickstart.md)
- API contract (single source of truth): [specs/001-app-foundation/contracts/openapi.yaml](specs/001-app-foundation/contracts/openapi.yaml)
