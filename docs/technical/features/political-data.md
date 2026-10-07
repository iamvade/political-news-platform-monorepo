# Political data: admin CRUD, audit log, bulk imports

## Overview

**Built (API + admin screens).** Data editors maintain persons, organizations, positions, bills (+ sponsors), bill stages, votes, statements, promises (with a dated status history), declarations and corrections. Every change is audited. Votes and positions can be bulk-imported from JSON with a dry-run diff.

The admin has screens for persons, bills (with a vote-entry grid), promises and corrections ([admin](../projects/admin.md#political-data-screens)). Organizations still have only a list.

## How it works

### Admin CRUD (`/v1/admin/*`)

Each resource has `GET /` (paginated), `GET /:id`, `POST /` (201), `PATCH /:id`, `DELETE /:id` (204). Roles: `data_editor` and `admin` only.

| Path | List filters | Delete |
|---|---|---|
| `/persons` | `search` (names, slug), `includeDeleted` (admin) | soft (data_editor, admin) |
| `/organizations` | `type`, `parentId`, `search`, `includeDeleted` (admin) | soft (data_editor, admin) |
| `/positions` | `personId`, `organizationId`, `current` | hard (admin) |
| `/bills` (+ `PUT /bills/:id/sponsors`) | `status`, `search` | hard (admin); 409 if votes exist |
| `/bill-stages` | `billId` | hard (admin) |
| `/votes` | `billId`, `personId`, `date`, `motion` | hard (admin) |
| `/statements` | `personId`, `articleId` | hard (admin) |
| `/promises` (+ `POST /promises/:id/status`, `GET /promises/:id/updates`) | `personId`, `organizationId`, `status` | hard (admin) |
| `/declarations` | `personId`, `year` | hard (admin) |
| `/corrections` | `entityType`, `entityId` | hard (admin) |

- Slugs for persons (`Г.Батбаяр` → `g-batbayar`), organizations and bills are generated when omitted, with `-2`… on collision.
- Soft-deleted rows return 404 and disappear from lists and every public route.
- Validation lives in the shared Zod schemas (http(s) `source_url`, ordered dates, exactly one promise subject, decimal-string amounts); the DB constraints are the backstop.

### Promise status history

- **Status is never set on create or update.** The `status` field is `z.never()` in both bodies, so sending it returns 400 `VALIDATION_ERROR`. New promises start as `not_rated`.
- **Changing the status** goes through `POST /v1/admin/promises/:id/status` with `{ status, date, noteMn, sourceUrl }`. All four are required, and the URL is the evidence.
- In one transaction it:
  - locks the promise
  - inserts a `promise_updates` row (`created_by` = the user)
  - mirrors `status` on the promise
  - sets `last_reviewed_at = now()`
  - writes an audit row (`diff.status` plus `diff.promiseUpdate`)
- Sending the same status again is allowed. It records a dated review that confirmed it.
- `GET /promises/:id/updates` lists the history, newest first.
- The `evidence` jsonb array on the promise stays as a general list of supporting links.

### Vote entry (roster and sessions)

- **`GET /v1/admin/bills/:id/vote-roster?date=&motion=`** returns everyone the grid should list for that roll call:
  - **MPs serving on `date`**: an open-on-that-date position at an organization of type `parliament` (party-list seats) or `constituency`. Committee seats don't count. Ended seats, soft-deleted people and soft-deleted organizations are excluded.
  - Each person's **party on that date** (short name).
  - Their recorded vote for (bill, date, motion), if any.
  - Anyone who has a vote recorded but held no seat that day is appended with `inOffice: false`, so no recorded vote is hidden.
- **`GET /v1/admin/bills/:id/vote-sessions`** lists one entry per `(date, motion)`, newest first, with `counts` per value, `total` and the distinct `sourceUrls`.
- **Saving the grid** reuses the votes import (`personId` rows, one source URL for all rows): a dry run first for the "N new, M changed" confirmation, then the commit. Like every import it never deletes. A recorded vote can be changed but not removed from the grid; deleting one is the admin-only `DELETE /votes/:id`.
- Code: `modules/legislation/vote-entry.ts`.

### Audit log

Every mutation writes `audit_log` (`actor_id`, `action` ∈ create/update/delete/soft_delete/import, `entity_type`, `entity_id`, `diff`) **in the same transaction**. Updates store `{ field: { from, to } }` for changed fields.

### Error mapping (`lib/db-errors.ts`)

| Postgres | API |
|---|---|
| 23503 on insert/update | 400 `REFERENCE_NOT_FOUND` |
| 23503 on delete, 23001 (RESTRICT) | 409 `IN_USE` |
| 23505 unique | 409 `DUPLICATE` |
| 23514 CHECK, 23502 NOT NULL | 400 `VALIDATION_ERROR` |

### Bulk imports

`POST /v1/admin/votes/import` and `POST /v1/admin/positions/import` — body `{ dryRun?: boolean, rows: [...] }` (1–5,000 rows, body ≤ 5 MB).

- Rows reference entities by **exactly one** of id or slug (`personId` | `personSlug`, `billId` | `billSlug`, `organizationId` | `organizationSlug`).
- Votes match on `(bill, person, date, motion)` and update `value` / `sourceUrl`. Positions match on `(person, organization, titleMn, startDate)`; fields omitted from a row are left unchanged, explicit `null` clears them.
- One transaction: validate → resolve refs → load existing → classify create / update / unchanged → apply → **one** audit row.
- **Dry run executes the same code and rolls back** (`runImport`), so constraint errors surface exactly as in a real run.
- Response: `{ data: { dryRun, summary: { create, update, unchanged }, diff: { create: [...], update: [{ key, before, after }] } } }`.
- Unknown/soft-deleted references and duplicate keys in the payload → 400 `IMPORT_INVALID` with `details: [{ path: 'rows.N.field', message }]`; malformed rows → 400 `VALIDATION_ERROR` (`body.rows.N…`). Nothing is written in either case.
- Imports never delete.

## Tech used

Drizzle (row locks `FOR UPDATE`), shared Zod schemas, `lib/imports.ts` (`runImport`, `ImportIssues`, `loadRefs`).

## How to start

```bash
curl -b jar -H 'origin: http://localhost:4000' -H "x-csrf-token: $CSRF" -H 'content-type: application/json' \
  -d '{"dryRun":true,"rows":[{"billSlug":"tax-general-law-amendment-2025","personSlug":"g-batbayar","value":"yes","date":"2025-04-17","motion":"final_vote","sourceUrl":"https://source.example/v"}]}' \
  localhost:4000/v1/admin/votes/import
```

## How to maintain

- New resource: schemas in `packages/shared/src/schemas/<domain>.ts`, service functions (list/get/create/update/delete with `audit()`), explicit routes in the domain's `admin.routes.ts`, an entry in `RESOURCES` (`apps/api/src/test/political.ts`) so the role matrix and CRUD tests cover it.
- New import: follow `modules/legislation/import.ts` — `runImport` + `ImportIssues` + `loadRefs`.

## Notables

- There is deliberately **no generic CRUD factory**; routes and services are explicit per resource (CLAUDE.md: boring, explicit code).
- Re-running an import with no changes still writes an audit row (records that the import ran).
- No route restores soft-deleted persons/organizations yet.
- "Who is an MP" is derived (open position at a `parliament`/`constituency` organization). There is no MP flag. A seat entered on the wrong organization type will be missing from the vote grid.
- Promise statuses in code (`kept`, `in_progress`, `broken`, `not_rated`) differ from the six in PRD §6.1. Existing rows keep their status but have no history before migration 0006.
- Organization members (public) are sorted alphabetically by title, so "Гишүүн" lists before "Дарга"; ranking leadership needs an agreed title order.

## Key files

`apps/api/src/modules/{people,legislation,records,corrections}/` (incl. `legislation/vote-entry.ts`), `apps/api/src/lib/{audit,crud,db-errors,imports,slugs}.ts`, `apps/api/src/db/schema/audit.ts`, `packages/shared/src/schemas/{people,legislation,records,corrections,imports}.ts`.

---
Last updated: 2026-10-07 — promise status history (`promise_updates`, status endpoint), vote roster and sessions, admin screens.
