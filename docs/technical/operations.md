# Operations

## Overview

Day-to-day commands, database and storage workflows, dependency maintenance, and the production checklist. Deployment automation (Docker image, CI) does not exist yet.

## How it works

All root scripts delegate to a workspace package. The API package owns the database, storage and admin CLIs.

| Command | What it does |
|---|---|
| `pnpm dev` | All apps in parallel |
| `pnpm build` | Builds every package (API → `apps/api/dist/*.mjs` via tsdown) |
| `pnpm lint` | ESLint (flat config at the root) |
| `pnpm typecheck` | `tsc --noEmit` in every package (web runs `next typegen` first) |
| `pnpm test` | Vitest in `packages/shared`, `apps/api` (needs Docker), `apps/admin` and `apps/web` (jsdom) |
| `pnpm db:generate` | `drizzle-kit generate` from the schema (`--name=<slug>` recommended) |
| `pnpm db:migrate` | Applies pending migrations (`apps/api/src/db/migrate.ts`) |
| `pnpm db:seed [--reset]` | Sample data; refuses if data exists unless `--reset` (which **truncates every table**) |
| `pnpm admin:create --email … --name …` | Creates an admin user (password prompted or `ADMIN_PASSWORD`) |
| `pnpm storage:init` | Creates both media buckets if missing and sets CORS on the originals bucket |
| `pnpm -F @news/api start` | Runs the built API (`node dist/server.mjs`) |
| `pnpm -F @news/api test:watch` | Vitest watch mode for the API |
| `pnpm -F @news/mobile exec expo <cmd>` | Any Expo CLI command (login, install, doctor…) |

## Tech used

pnpm 12 workspaces with catalogs (shared versions for `typescript`, `zod`, `vitest`, `@types/node`), Drizzle Kit for migrations, tsx for CLIs, tsdown for the API build.

## How to start

See [getting-started.md](getting-started.md). This page assumes the stack is installed.

## How to maintain

### Database migrations

1. Change a schema file in `apps/api/src/db/schema/<domain>.ts`.
2. `pnpm db:generate --name=<what_changed>` — **read the SQL**. Watch for drops, and for renames that Drizzle detected as drop + add.
3. `pnpm db:migrate` locally; `pnpm test` (the test DB migrates itself in Vitest `globalSetup`).
4. Commit the SQL and `drizzle/meta/*`.

Rules: never edit, rename or delete a migration that has been applied anywhere (fix forward). Never use `drizzle-kit push` against a shared, staging or production database. Hand-written SQL (extensions, backfills) is fine **before** the migration is applied anywhere — say so in a comment in the file.

### Seeding and resetting

- `pnpm db:seed` inserts fictional people, real party names, 3 bills with votes, 10 articles, etc. (`apps/api/src/db/seeder.ts`). Sources point at `https://source.example/…`.
- `pnpm db:seed --reset` **wipes all tables first** — including any admin you created. Re-run `pnpm admin:create` afterwards.

### Admin users

`pnpm admin:create --email you@example.mn --name "Нэр"` prompts twice for a hidden password (12–256 chars). For CI: `ADMIN_PASSWORD=… pnpm admin:create …` (never put a password on the command line). Fails if the email exists (case-insensitive).

### Storage

`pnpm storage:init` is safe to re-run. Locally it targets SeaweedFS (`docker compose`), in production R2 — same script, different env.

### Dependency updates

- **pnpm release-age guard**: pnpm 12 refuses versions published in the last day. If an install needs a brand-new version, prefer loosening the range (e.g. `^16.3.0` instead of `^16.4.0`) over adding `minimumReleaseAgeExclude` entries — the guard is supply-chain protection.
- **Build scripts** are opt-in in `pnpm-workspace.yaml` → `allowBuilds`: `esbuild`, `@swc/core`, `@parcel/watcher` allowed; `msgpackr-extract` denied (optional speed-up for BullMQ). New packages that want install scripts fail the install until you approve/deny them (`pnpm approve-builds <pkg>` / `'!<pkg>'`).
- **TypeScript is pinned to 6.0.x** (catalog) because typescript-eslint 8 does not support TS 7 yet.
- **Expo**: keep native modules on the SDK's versions: `pnpm -F @news/mobile exec expo install --fix`. `react-native-worklets` and `react-native-reanimated` are pinned explicitly and `@react-native/metro-config` is overridden in `pnpm-workspace.yaml` to stop auto-installed peers drifting.
- After any dependency change: `pnpm peers check`, `pnpm typecheck`, `pnpm test`.

### Tests

- Need `docker compose` running. They use the `news_test` database (setup refuses any DB whose name does not end in `_test`) and Redis db 15.
- The test env (`apps/api/src/test/test-env.ts`) raises the global rate limit (all requests share one IP) and points media at in-memory storage.

### Stray dev servers

`tsx watch` runs as `…/tsx/dist/cli.mjs watch …`, so `pkill -f "tsx watch"` does **not** match it. Use:

```bash
pkill -f "tsx/dist/cli.mjs watch --env-file-if-exists=.env src/server.ts"
pkill -f -- "--env-file-if-exists=.env src/server.ts"
lsof -nP -iTCP:4000 -sTCP:LISTEN    # should print nothing
```

### Production checklist

Not automated yet; the API refuses to start when the critical items are wrong.

- `NODE_ENV=production`, `SESSION_COOKIE_SECURE=true` (enforced), strong `AUTH_SECRET`.
- `TRUST_PROXY=true` behind Cloudflare; firewall the origin to Cloudflare IPs.
- Two R2 buckets: **originals private**, **public** with a custom domain → `MEDIA_PUBLIC_BASE_URL`. All `S3_*` / `MEDIA_*` set (enforced). Run `pnpm storage:init` once (CORS for the admin origin).
- `CORS_ORIGINS` = admin + web origins.
- Web: `API_URL`, `SITE_URL` (the public origin, required: canonical, Open Graph and JSON-LD URLs) and `WEB_REVALIDATE_SECRET`.
- API: `WEB_REVALIDATE_URL=${SITE_URL}/api/revalidate` (or the web container's internal URL) and `WEB_REVALIDATE_SECRET` with the **same** value as the web's (≥ 32 chars). Check: a publish logs `Revalidated cache tags` in the web logs.
- `WORKERS_ENABLED`: true for a single process; to split, run the same image twice (API with `false`, worker with `true`).
- Run `pnpm db:migrate` before starting a new version.

## Notables

- **No backups are configured yet** (PRD §11.5 asks for WAL archiving + restore drills). Do this before real data exists.
- **No CI/deployment pipeline yet.**
- The seed's media rows reference R2 keys that do not exist; their variant URLs 404.

## Key files

`package.json`, `pnpm-workspace.yaml`, `apps/api/package.json`, `apps/api/drizzle.config.ts`, `apps/api/src/db/{migrate,migrator,seed,seeder}.ts`, `apps/api/src/cli/{create-admin,storage-init}.ts`.

---
Last updated: 2026-10-07 — production checklist: web `SITE_URL` and the shared revalidation secret. Earlier: web tests in `pnpm test`.
