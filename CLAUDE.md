# CLAUDE.md

Read this before every task. The product spec is in `docs/PRD.md`; read the relevant section when a task touches a feature.

## Project

Mongolian political news platform. It combines articles with living profiles of officials: 126 MPs of the State Great Khural, cabinet members, agency heads and experts. Profiles show positions over time, party, constituency, committees, asset declarations, statements, bills, votes, promises and tagged articles.

- Every factual record carries a source (`source_url`); this is a core product rule.
- The UI is Mongolian (Cyrillic). English comes later.
- Search must match Latin-typed Mongolian against Cyrillic.
- Solo developer, so keep it simple. Boring, explicit code beats clever abstractions.

## Stack

Exact versions live in each `package.json` and `.nvmrc`. Check the installed version before using an API you are unsure of. Baseline: Node 24 LTS, pnpm 12 (via corepack), TypeScript 6.0 (not 7: typescript-eslint does not support it yet), Zod 4.

| Area | Tech |
|---|---|
| API | Fastify 5, TypeScript (strict), Drizzle ORM, Zod via `fastify-type-provider-zod`, `@fastify/swagger` (OpenAPI) |
| Data | PostgreSQL (`pg_trgm`), Redis, BullMQ |
| Admin | React + Vite SPA, Tiptap editor (content stored as ProseMirror JSON) |
| Web | Next.js App Router, ISR + on-demand revalidation, `next-intl` |
| Mobile | Expo (React Native), Expo Push, EAS Update |
| Media | Cloudflare R2 (presigned uploads), sharp workers |
| Infra | pnpm workspaces (+ catalogs), Docker Compose on one VPS, Cloudflare CDN in front. Local dev: Postgres on host port 5433, Redis on 6379 |
| Tests | Vitest |

## Monorepo layout

```
apps/
  api/      Fastify API + BullMQ workers (@news/api)
  admin/    Newsroom admin SPA (@news/admin)
  web/      Public Next.js site (@news/web)
  mobile/   Expo app (@news/mobile)
packages/
  shared/   (@news/shared)
    src/schemas/   Zod schemas: API request/response contracts, shared enums
    src/api-client/ Typed fetch client (createApiClient) used by admin, web, mobile
    src/content/   ProseMirror/Tiptap node schema + validators
    src/policies/  Article permission rules (can, TRANSITIONS), used by API and admin
    src/translit/  Cyrillic↔Latin transliteration + search skeleton
    src/i18n/      Shared message keys/types (not the message text itself)
docs/       PRD.md (product spec) and technical/ (how each project and feature works; keep current)
```

Dependency direction: `apps/*` import from `packages/shared`. Apps never import from each other. `shared` must stay runtime-agnostic: no Node-only, DOM-only or React Native-only code.

## Commands

```
pnpm install
pnpm dev                          # all apps
pnpm -F @news/api dev
pnpm -F @news/api db:generate     # drizzle-kit generate (after schema change)
pnpm -F @news/api db:migrate      # apply migrations
pnpm test                         # all Vitest suites
pnpm -F @news/api test
pnpm lint && pnpm typecheck
```

If a script is missing, add it in the same style. Do not invent alternative script names.

## API conventions (`apps/api`)

- **One Fastify plugin per domain** in `src/modules/<domain>/`, e.g. `articles`, `people`, `organizations`, `media`, `homepage`, `search`, `feedback`, `auth`. Each module has:
  - `public.routes.ts`: public endpoints
  - `admin.routes.ts`: admin endpoints
  - `service.ts`: business logic and DB access
  - `index.ts`: registers the plugin
- **Route handlers stay thin**: validate, call the service, shape the response. No Drizzle queries in handlers.
- **Versioning and prefixes:**
  - `/v1/public/*`: no auth, cacheable. The public scope's `onSend` hook sets `Cache-Control`; pick a preset per route with `config: { cache: 'news' | 'profile' }` (`lib/cache.ts`). Public DTOs live in `@news/shared/schemas/public` and must never expose internal fields.
  - `/v1/admin/*`: session cookie auth plus a role check via the `requireRole(...)` hook. Never rely on the UI to hide actions.
    Register admin modules inside the **protected scope** in `app.ts` (it already applies `requireAuth` + `verifyCsrf`); add `onRequest: app.requireRole(...)` per route (**onRequest, not preHandler**: auth and roles must run before body validation, so unauthorised callers get 401/403, never schema errors). Roles are explicit: `admin` does not pass `requireRole('editor')`. On non-GET admin routes also set `schema.security: csrfSecurity` (from `plugins/swagger.ts`) so Swagger UI sends `X-CSRF-Token`.
- **Schemas:**
  - Every route declares a `schema` (params, querystring, body, response per status) using Zod schemas imported from `@news/shared`. Do not define ad-hoc Zod schemas inline in routes.
  - Response schemas are mandatory: they strip unlisted fields and drive the OpenAPI output.
- **Success shapes:**
  - Single item: `{ "data": { ... } }`
  - List: `{ "data": [ ... ], "pagination": { "page": 1, "pageSize": 20, "total": 134, "totalPages": 7 } }`
  - Query params `page` (1-based, default 1) and `pageSize` (default 20, max 100).
- **Error shape (always):** `{ "error": { "code": "ARTICLE_NOT_FOUND", "message": "Article not found" } }`
  - `code` is UPPER_SNAKE_CASE, stable and part of the API contract. Clients map codes to Mongolian UI text.
  - `message` is English, developer-facing, and must never contain secrets or SQL.
  - Validation errors use `VALIDATION_ERROR` and may add `details` (field issues).
  - All errors go through the global error handler. Throw typed `AppError(code, status, message)`; do not `reply.send` error objects by hand.
- **Mutations write `audit_log`** (actor, action, entity, diff) inside the same transaction, via `audit(tx, …)` (`lib/audit.ts`); use `diffOf(before, after)` for updates.
- **Constraint violations** are mapped centrally (`lib/db-errors.ts`): FK on write → 400 `REFERENCE_NOT_FOUND`, FK/RESTRICT on delete → 409 `IN_USE`, unique → 409 `DUPLICATE`, CHECK → 400. Let the DB enforce invariants; don't pre-query to duplicate them.
- **Bulk imports** use `runImport()` (`lib/imports.ts`): one transaction, `dryRun` rolls back the identical code path, row problems → 400 `IMPORT_INVALID` with `rows.N.field` paths, one `audit_log` row per import, upsert only.
- **Publishing side effects** run as idempotent BullMQ jobs, never inline in the request: revalidate, CDN purge, Facebook re-scrape, sitemap, push.
  Enqueue through `app.jobs` (`jobs/types.ts`) **after** the transaction commits; processors live in `jobs/processors/` as plain functions and must re-check DB state (see `publishIfDue`) so stale or duplicate jobs are harmless. Tests use `createFakeJobs()`.
- **Media:** browser uploads originals straight to storage via a presigned PUT (`content-type` + `content-length` signed), then calls confirm (size + magic-byte check), then the `media-variants` job writes WebP variants. **Originals live in the private bucket and are never exposed** (they keep EXIF/GPS); public/admin DTOs only carry variant URLs built from `MEDIA_PUBLIC_BASE_URL` + key. Storage goes through `app.storage` (`lib/storage.ts`); tests use `createMemoryStorage()`. Article covers must be `ready` with alt + credit.
- **IDs and slugs:** numeric ids are canonical. Slugs are Latin, generated with `@news/shared/translit`. A slug change inserts a `redirect`.
- **Time:** store and return UTC ISO 8601. Display in `Asia/Ulaanbaatar` on clients.

## Database conventions

- **Drizzle schema files per domain** in `apps/api/src/db/schema/<domain>.ts`, re-exported from `schema/index.ts`.
- **Migrations:**
  - Only via `drizzle-kit generate`, committed in `apps/api/drizzle/`.
  - **Never edit, rename or delete a migration that has been applied anywhere.** Fix forward with a new migration.
  - Never use `drizzle-kit push` against a shared, staging or production DB.
  - Review the generated SQL before committing. Watch for destructive drops and renames detected as drop+add.
- **Naming:** table and column names are `snake_case`; tables are plural (`articles`, `asset_declarations`).
- **Keys:** primary keys are `bigint` identity. Foreign keys are `<entity>_id` with explicit `onDelete` behaviour.
- **Timestamps:** every table has `created_at` and `updated_at` as `timestamp with time zone`, default `now()` (helpers in `db/columns.ts`). Exception: immutable rows (join tables, `article_revisions`) have `created_at` only. Never use timestamps without a time zone.
- **Indexes for "newest first" lists:** use plain ascending indexes; Postgres scans them backwards for `ORDER BY ... DESC`. Drizzle's `.desc()` emits `DESC NULLS LAST`, which does not match a plain `DESC` sort.
- **Soft delete:** `deleted_at timestamptz` on `persons`, `organizations`, `articles` and `media`. Services must exclude soft-deleted rows by default; hard delete is admin-only and audited.
- **Money and asset figures:** `numeric` (MNT), never float.
- **Translatable fields:** `name_mn` (not null) and `name_en` (nullable).
- **Provenance:** factual tables (`positions`, `bills`, `bill_stages`, `votes`, `statements`, `promises`, `promise_updates`, `declarations`) require `source_url text not null` plus a `^https?://` CHECK (use `sourceUrl` / `sourceUrlCheck` from `db/columns.ts`).
- **Rich text:** article bodies are stored as `jsonb` (ProseMirror) and validated with `@news/shared/content` before insert.
- **Queries:** add indexes for every FK and every filter or sort used by a list endpoint. Use transactions for multi-table writes.

## i18n rules

- **No hardcoded user-facing strings in components**, in any app. That includes Cyrillic literals, button labels, aria-labels, toasts and errors.
- **Message files:**
  - web: `apps/web/messages/mn.json` (`next-intl`)
  - admin: `apps/admin/src/locales/mn.json`
  - mobile: `apps/mobile/src/locales/mn.json`
  - Keys are namespaced (`article.updatedAt`, `errors.ARTICLE_NOT_FOUND`).
- **Mongolian is the only required locale.** When adding a key, add it to `mn.json` only, unless an `en.json` already exists for that app.
- **Formatting:** dates and numbers use the `mn-MN` locale through the i18n library, never manual string building.
- **Fonts and text:** text must render Ө ө Ү ү correctly. Never "simplify" them to О/У.
- **Admin UI:** primitives are shadcn/ui in `apps/admin/src/components/ui` (owned code; keep their text in `mn.json`). Lists use `DataTable` + `useListParams` + `useListQuery`; menu and route access come from `apps/admin/src/navigation.ts`. **Web UI:** build from `apps/web/src/components` and the semantic token utilities (`bg-surface`, `text-ink-muted`, `type-*`), never raw colours; show new components on `/styleguide` (`docs/technical/features/design-system.md`).

## Testing

- **Vitest everywhere.** Tests live next to the code as `*.test.ts`.
- **API route tests:**
  - Use `fastify.inject()` against `buildApp()` (the app factory, which never calls `listen`).
  - Assert status, body shape (parse with the shared Zod schema) and the error format.
- **Test database:**
  - A separate Postgres database whose name must end in `_test`. The test setup refuses to run otherwise.
  - Migrations are applied in Vitest `globalSetup`.
  - Tables are truncated between tests via the `resetDb()` helper.
  - Never point tests at dev or production data.
- **Workers and external services:**
  - Mock BullMQ, R2, the Facebook Graph API and other external HTTP calls at the service boundary.
  - Test job processors directly.
- **What needs tests:**
  - Every new route: one happy-path test plus auth/role and validation-error cases.
  - `shared/translit` changes must keep the golden query test set passing.
- **Before saying a task is done:** run `pnpm typecheck`, `pnpm lint` and the affected tests, report the results honestly, and update `docs/technical/` (or say why no doc change was needed).

## Documentation

- `docs/technical/` documents every project and feature (index: `docs/technical/README.md`). Read the relevant page before changing an area.
- **Every change that affects behaviour, setup, commands, env vars, routes, schema, jobs, dependencies or a gotcha updates the matching page in the same change**, including its `Last updated` line. New env var → the env table in `docs/technical/projects/api.md`.
- New project or feature → new page from the template in `docs/technical/README.md`, linked from the index.
- Docs describe what **is**, verified against the code. Plans go in `docs/PRD.md` or under a page's "Notables → follow-ups".

## Rules

1. **Propose a plan before editing.** List the files you will touch and the approach, then wait for approval. Trivial one-line fixes are the exception.
2. **Keep changes small.** One concern per change. No drive-by refactors, renames or formatting sweeps.
3. **Never touch unrelated files.** If you notice a problem elsewhere, mention it instead of fixing it.
4. **Never commit secrets.** Config comes from env vars validated with Zod at startup; update `.env.example` with placeholder values. Never log tokens, passwords, session ids or full request bodies on auth routes.
5. **Ask when unclear.** This covers ambiguous requirements, a data model change not covered by the PRD, a new dependency, and anything affecting published content, migrations or auth. Ask instead of guessing.
6. **Do not add dependencies without approval.** Prefer what is already in the repo.
7. **Do not change shared contracts silently.** Any change to a Zod schema in `@news/shared` or to an error code is an API change: say so explicitly and update every consumer.
8. **Respect the editorial invariants:**
   - Sources are required on factual records.
   - Substantive edits to published articles require a correction note.
   - Nothing is published without an explicit editor action or a scheduled job.
9. **No destructive commands** (dropping DBs, `git reset --hard`, deleting migrations or R2 objects) without explicit confirmation.
