# Getting started

## Overview

From a fresh clone to a running stack: Postgres, Redis and S3-compatible storage in Docker; the API, admin, web and mobile apps on your machine.

## How it works

`docker compose` runs the infrastructure; `pnpm dev` runs every app in parallel (`pnpm -r --parallel --stream dev`). The API reads `apps/api/.env`; each other app has its own `.env`.

| Service | Address | Started by |
|---|---|---|
| API | http://localhost:4000 (Swagger UI: `/docs`, dev only) | `pnpm dev` |
| Admin SPA | http://localhost:5173 | `pnpm dev` |
| Web | http://localhost:3000 | `pnpm dev` |
| Expo / Metro | http://localhost:8081 | `pnpm dev` |
| PostgreSQL 18 | localhost:**5433** (container port 5432) | `docker compose` |
| Redis 8 | localhost:6379 | `docker compose` |
| SeaweedFS (S3 API) | http://localhost:8333 | `docker compose` |

Postgres is published on **5433** so it does not clash with a native Postgres on 5432. Override with `POSTGRES_PORT=… docker compose up -d`.

## Tech used

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 LTS (`.nvmrc` → 24.21.0) | React Router 8 and Vitest 5 need Node ≥ 22.22 |
| pnpm | 12.9.1 via corepack (`packageManager` in `package.json`) | |
| Docker Desktop | any recent | Compose v2 |

## How to start

### First time

```bash
# 1. Toolchain
nvm install && nvm use          # reads .nvmrc
corepack enable                 # provides pnpm 12.9.1

# 2. Dependencies
pnpm install

# 3. Infrastructure (Postgres, Redis, SeaweedFS); also creates the news_test database
docker compose up -d --wait

# 4. Env files
for a in api admin web mobile; do [ -f apps/$a/.env ] || cp apps/$a/.env.example apps/$a/.env; done
#    then set a real secret in apps/api/.env:
#    AUTH_SECRET=$(openssl rand -base64 48)

# 5. Database
pnpm db:migrate
pnpm db:seed                    # optional sample data (fictional people, 10 articles)

# 6. Media buckets (+ CORS) in local SeaweedFS
pnpm storage:init

# 7. An admin you can log in with (password prompted, hidden)
pnpm admin:create --email you@example.mn --name "Your Name"

# 8. Run everything
pnpm dev
```

Seeded users (`admin@`, `editor@`, `reporter@newsroom.example`) have **no password**; log in with the account from step 7.

### Every day

```bash
docker compose up -d --wait
pnpm dev
```

### Log in to the admin

Open http://localhost:5173 and sign in with the account from step 7. Use Chrome or Firefox; Safari needs `SESSION_COOKIE_SECURE=false` in `apps/api/.env` (see troubleshooting).

### Log in from Swagger

1. Open http://localhost:4000/docs and run `POST /v1/admin/auth/login` with your email/password. The browser stores the session cookie.
2. Copy `data.csrfToken` from the response, click **Authorize**, paste it into `csrfToken`.
3. State-changing admin routes now send `X-CSRF-Token`. The token changes on every login.

### Checks

```bash
curl localhost:4000/health/ready     # {"data":{"status":"ok","checks":{"database":"ok","redis":"ok"}}}
pnpm test                            # needs docker compose running (uses news_test + Redis db 15)
pnpm typecheck && pnpm lint
```

## How to maintain

- Add new env vars to the right `.env.example` and to the env table in [projects/api.md](projects/api.md).
- If a step here changes (new service, new init command), update this page in the same change.

## Notables

Troubleshooting:

| Symptom | Cause / fix |
|---|---|
| `Command "expo" not found` / `pnpm expo …` fails at the root | Expo is only installed in `apps/mobile`: `pnpm -F @news/mobile exec expo <cmd>` |
| `pnpm: command not found` | Run `corepack enable` (Node 24 via nvm) |
| `Cannot connect to the Docker daemon` | Start Docker Desktop (`open -a Docker`) |
| Tests or the API connect to the wrong Postgres | Something else listens on 5432; the stack uses **5433** (`DATABASE_URL=…localhost:5433/news`) |
| `Invalid environment variables: AUTH_SECRET` | Set `AUTH_SECRET` (≥ 32 chars) in `apps/api/.env` |
| Login works in Chrome but not Safari | Safari rejects `Secure` cookies on `http://localhost`; set `SESSION_COOKIE_SECURE=false` locally (refused in production) |
| `listen EADDRINUSE :4000` | A previous dev server is still running; see "Stray dev servers" in [operations.md](operations.md) |
| Media routes return 503 | Storage env vars missing; copy the `S3_*` / `MEDIA_*` block from `apps/api/.env.example` and run `pnpm storage:init` |
| Physical phone cannot reach the API | Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your LAN IP, not localhost |

## Key files

- `package.json` (root scripts), `.nvmrc`, `pnpm-workspace.yaml`
- `docker-compose.yml`, `docker/postgres/init.sql`, `docker/seaweedfs/s3.json`
- `apps/*/.env.example`

---
Last updated: 2026-10-07 — admin login step.
