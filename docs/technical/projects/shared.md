# Shared package (`packages/shared`)

## Overview

**Built.** The contract layer used by the API and every client: Zod schemas (requests, responses, enums, error codes), the article content allowlist, HTML renderer and embed parser, the article permission policy, Mongolian slug transliteration, and a typed fetch-based API client.

## How it works

Source-only TypeScript package — `exports` point straight at `.ts` files, there is no build step. Each consumer compiles it: Vite (admin), Next (`transpilePackages`), Metro (mobile), tsx/Vitest (API), and tsdown bundles it into the API's production build.

| Export | Contents |
|---|---|
| `@news/shared/schemas` | `common` (ErrorCode, pagination, `dataResponse`/`listResponse`, field schemas), `enums` (roles, statuses, kinds — also used to build Postgres enums), `auth`, `articles`, `lookup` (editor pickers, tag creation), `people`, `legislation`, `records`, `corrections`, `imports`, `media`, `public` |
| `@news/shared/content` | `contentDocSchema` (Tiptap allowlist + depth guard; nodes include `image` with caption/credit, `embed`, `pullQuote`), `renderHtml`, `hasText`, `escapeHtml`, `parseEmbedUrl` (YouTube/Facebook URL → canonical URL + the only iframe `src` ever rendered) |
| `@news/shared/policies` | `can(user, action, article?)`, `TRANSITIONS`, `canTransition` — article permissions, enforced by the API and used by the admin to show workflow buttons |
| `@news/shared/translit` | `slugify` (Mongolian Cyrillic → ASCII slug), `SLUG_PATTERN`, `SLUG_MAX_LENGTH` |
| `@news/shared/api-client` | `createApiClient`, `ApiError`, `isApiError` |
| `@news/shared` | everything above |

### API client

`createApiClient({ baseUrl, fetch?, credentials?, headers?, getCsrfToken? })` returns `request()` plus typed groups. Every response is parsed with its Zod schema; non-2xx responses throw `ApiError { status, code, message, details? }` built from the API's error body.

| Group | Methods |
|---|---|
| `health` | `get`, `ready` |
| `auth` | `login`, `me`, `logout` |
| `articles` | `list`, `get`, `create`, `update`, `submit`, `returnToDraft`, `publish`, `schedule`, `unpublish`, `revisions`, `restoreRevision` |
| `admin.<resource>` | `list`, `get`, `create`, `update`, `remove` for persons, organizations, positions, bills (+ `replaceSponsors`), billStages, votes, statements, promises, declarations, corrections |
| `admin.media` | `requestUpload`, `confirm`, `list`, `get`, `update`, `uploadFile(file, { filename, alt?, credit? })` |
| `admin.import` | `votes`, `positions` |
| `lookup` | `search(kind, { search?, ids?, limit? })` for persons, organizations, bills, categories, tags |
| `taxonomy` | `createTag({ nameMn, nameEn? })` |
| `public` | `articles.list/get`, `categories.get/articles`, `tags.get/articles`, `persons.get/positions/articles/votes/statements/promises/declarations`, `organizations.get`, `bills.get` |

Admin usage: `credentials: 'include'` and `getCsrfToken: () => token` (token from `auth.login`/`auth.me`); the client adds `X-CSRF-Token` to every non-GET request. `uploadFile` PUTs straight to storage **without** API cookies or the CSRF header.

## Tech used

zod 4 (only runtime dependency), TypeScript 6.0, Vitest.

## How to start

```bash
pnpm -F @news/shared typecheck
pnpm -F @news/shared test
```

## How to maintain

- **Contract changes are API changes** (CLAUDE.md rule 7): changing or removing a schema field or error code must be called out and every consumer updated. Additive changes are preferred.
- New enum → add the `as const` array to `enums.ts`; build the `pgEnum` from it in the API schema and generate a migration.
- New endpoint → add request/response schemas here first, then the route, then a client method.
- Keep it **runtime-agnostic**: no Node-only, DOM-only or React Native imports.

## Notables

- Relative imports are **extensionless** (`./common`, not `./common.js`) — Metro cannot map `.js` to `.ts`.
- Response DTOs use ISO strings for dates (`isoDateTimeSchema`) and decimal **strings** for MNT amounts (no floats).
- Public DTOs (`schemas/public.ts`) must never carry internal fields (emails, `deletedAt`, editor ids).
- `contentDocSchema` rejects unknown Tiptap nodes and marks — the admin editor and this allowlist must change together (see [articles](../features/articles.md)).
- Embeds store only the canonical URL; `renderHtml` derives the iframe `src` from `parseEmbedUrl` at render time, so a stored document can never point an iframe elsewhere.
- Policies live here (not in the API) so the admin's buttons and the API's 403s cannot drift. The API's `modules/articles/policy.ts` only re-exports them.

## Key files

`src/schemas/*.ts`, `src/content/{schema,render,embed}.ts`, `src/policies/articles.ts`, `src/translit/slugify.ts`, `src/api-client/{client,errors}.ts`, tests next to each.

---
Last updated: 2026-10-07 — embed/pull-quote/image-caption nodes, `parseEmbedUrl`, policies moved here, lookup schemas, article link ids, `EDIT_CONFLICT`, `autosave` revision kind.
