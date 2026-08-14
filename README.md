# FlyAccounts

FlyAccounts requires an organizational Microsoft work or school account before anyone can use the application. Microsoft proves identity only. Roles are assigned inside the app. A signed-in person with no roles sees pending access; a person with one or more roles sees a combined landing. The working-and-connected confirmation is available after sign-in on that landing, not as a public home.

## Stack

- Frontend: React
- Backend: FastAPI
- Database: PostgreSQL
- File storage: S3-compatible (MinIO locally)

## Layout

- `frontend/` — sign-in, pending access, combined landing, and access administration
- `backend/` — the API that implements the published contract
- `deployment/` — shared Docker Compose and environment files

## Start

```bash
cp deployment/.env.example deployment/.env
```

Set these in `deployment/.env` (never commit real values):

- `MICROSOFT_TENANT_ID` / `VITE_MICROSOFT_TENANT_ID`
- `MICROSOFT_CLIENT_ID` / `VITE_MICROSOFT_CLIENT_ID`
- `INITIAL_ADMIN_EMAIL` — organizational Microsoft work email of the first administrator
- `JWT_SIGNING_KEY` — long random string used to sign access JWTs
- `JWT_ACCESS_TTL_SECONDS` — default `900`
- `JWT_REFRESH_TTL_SECONDS` — default `604800`

```bash
docker compose --env-file deployment/.env -f deployment/docker-compose.yml up --build
```

Open the frontend URL (default http://localhost:8080) and sign in with Microsoft.

## Secrets

Never commit `deployment/.env`. Use `deployment/.env.example` as the template. There is no dummy, bypass, or local-password sign-in path.

## Links

- Validation walkthrough: [specs/002-microsoft-auth-rbac/quickstart.md](specs/002-microsoft-auth-rbac/quickstart.md)
- API contract (single source of truth): [specs/002-microsoft-auth-rbac/contracts/openapi.yaml](specs/002-microsoft-auth-rbac/contracts/openapi.yaml)
