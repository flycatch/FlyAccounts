# FlyAccounts

FlyAccounts requires an organizational Microsoft work or school account before anyone can use the application. Microsoft proves identity only. Roles and permissions are assigned inside the app.

People may be **invited** by organizational work email, or they may sign in with a valid organizational Microsoft account **without an invite**. A signed-in person with no roles sees pending access; a person with one or more roles sees a combined landing (Home). Settings → Users / Roles / Permissions replaces the previous standalone access-administration screen.

## Stack

- Frontend: React
- Backend: FastAPI
- Database: PostgreSQL
- File storage: S3-compatible (MinIO locally)

## Layout

- `frontend/` — sign-in, pending access, combined landing (Home), and Settings (Users, Roles, Permissions)
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

- Validation walkthrough: [specs/003-user-management/quickstart.md](specs/003-user-management/quickstart.md)
- API contract (single source of truth): [specs/003-user-management/contracts/openapi.yaml](specs/003-user-management/contracts/openapi.yaml)
- Settings chrome and tokens: [specs/003-user-management/ui-spec.md](specs/003-user-management/ui-spec.md)
