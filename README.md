# news-v2

Mongolian political news platform. It combines articles with living profiles of officials: the 126 MPs of the State Great Khural, cabinet members, agency heads and experts. Profiles show positions over time, party, constituency, committees, asset declarations, statements, bills, votes, promises and tagged articles.

- Every factual record carries a source.
- The UI is Mongolian (Cyrillic); English comes later.
- One API serves the public site, the mobile app and the newsroom admin.

## Status

| Project | What it is | Status |
|---|---|---|
| [`apps/api`](docs/technical/projects/api.md) | Fastify API + BullMQ workers | Built |
| [`packages/shared`](docs/technical/projects/shared.md) | Zod contracts, content renderer, translit, typed API client | Built |
| [`apps/admin`](docs/technical/projects/admin.md) | Newsroom SPA | Built: article editor, political data screens, homepage editor |
| [`apps/web`](docs/technical/projects/web.md) | Public Next.js site | Design system and `/styleguide`; pages pending |
| [`apps/mobile`](docs/technical/projects/mobile.md) | Expo app | Scaffold |

## Stack

- **API:** Fastify 5, TypeScript (strict), Drizzle ORM, Zod 4 (`fastify-type-provider-zod`), OpenAPI via `@fastify/swagger`
- **Data:** PostgreSQL (`pg_trgm`), Redis, BullMQ
- **Admin:** React + Vite, Tailwind + shadcn/ui, TanStack Query, Tiptap editor
- **Web:** Next.js App Router, `next-intl`
- **Mobile:** Expo (React Native)
- **Media:** Cloudflare R2 with presigned uploads and sharp WebP variants (SeaweedFS locally)
- **Tooling:** Node 24 (`.nvmrc`), pnpm 12 workspaces via corepack, TypeScript 6, Vitest, ESLint

## Repo layout

```
apps/
  api/        Fastify API, Drizzle schema + migrations, BullMQ jobs, CLIs
  admin/      Newsroom admin SPA
  web/        Public Next.js site
  mobile/     Expo app
packages/
  shared/     Zod schemas, content allowlist + renderer, policies, translit, API client
docs/
  PRD.md      Product spec
  technical/  How each project and feature works
docker/       Postgres init SQL, SeaweedFS S3 config
docker-compose.yml
```

## Quick start

Needs Node 24 (nvm), Docker Desktop and corepack.

```bash
nvm install && nvm use          # reads .nvmrc
corepack enable                 # provides pnpm 12
pnpm install

docker compose up -d --wait     # Postgres, Redis, SeaweedFS (+ the news_test database)

for a in api admin web mobile; do [ -f apps/$a/.env ] || cp apps/$a/.env.example apps/$a/.env; done
# then set a real secret in apps/api/.env:  AUTH_SECRET=$(openssl rand -base64 48)

pnpm db:migrate
pnpm db:seed                    # optional sample data
pnpm storage:init               # media buckets + CORS
pnpm admin:create --email you@example.mn --name "Your Name"   # password is prompted

pnpm dev
```

Then open the admin at http://localhost:5173 and log in with the account you just created (seeded users have no password). Details, Swagger login and troubleshooting: [docs/technical/getting-started.md](docs/technical/getting-started.md).

## Local services

| Service | Address |
|---|---|
| API | http://localhost:4000 (Swagger UI at `/docs`, development only) |
| Admin | http://localhost:5173 |
| Web | http://localhost:3000 |
| Expo / Metro | http://localhost:8081 |
| PostgreSQL | localhost:**5433** (not 5432, to avoid clashing with a native install) |
| Redis | localhost:6379 |
| SeaweedFS (S3 API) | http://localhost:8333 |

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Run every app in parallel |
| `pnpm build` | Build every package |
| `pnpm lint` | ESLint across the repo |
| `pnpm typecheck` | `tsc --noEmit` in every package |
| `pnpm test` | Vitest in shared, api (needs Docker) and admin |
| `pnpm db:generate --name=<slug>` | Generate a migration from the Drizzle schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed [--reset]` | Sample data (`--reset` truncates every table first) |
| `pnpm admin:create --email … --name …` | Create an admin user |
| `pnpm storage:init` | Create the media buckets and set CORS |

Run one package with `pnpm -F @news/<api|admin|web|mobile|shared> <script>`. The full list is in [docs/technical/operations.md](docs/technical/operations.md).

## Documentation

- [docs/PRD.md](docs/PRD.md): what we build and why
- [docs/technical/](docs/technical/README.md): architecture, each project and feature, how to run and maintain them
- [docs/technical/operations.md](docs/technical/operations.md): migrations, seeding, dependency updates, production checklist
- [CLAUDE.md](CLAUDE.md): conventions and rules for anyone (human or AI) changing the code

## Working on the repo

- **Never commit secrets.** Config comes from env vars validated at startup; add new ones to the matching `.env.example` with placeholder values.
- **Migrations** are generated with `pnpm db:generate` and committed. Never edit, rename or delete one that has been applied anywhere; fix forward.
- **UI text** goes in the app's `mn.json`, never inline in components.
- **Docs** in `docs/technical/` are updated in the same change as the behaviour they describe.
- **Before calling something done:** `pnpm typecheck && pnpm lint && pnpm test`.

See [CLAUDE.md](CLAUDE.md) for the full API, database, i18n and testing conventions.
