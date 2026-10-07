# Background jobs

## Overview

**Built**, with two placeholders. BullMQ queues on Redis handle scheduled publishing, publish side effects and image processing. Push notifications and search indexing are **placeholders** (enqueued, logged, no-op).

## How it works

Services never talk to BullMQ directly; they call the `Jobs` interface (`app.jobs`, `jobs/types.ts`) **after their transaction commits**. If enqueueing fails it is logged, not thrown — the database is the source of truth, and the sweep catches lost scheduled publishes.

| Queue | Job | Triggered by | Processor | Notes |
|---|---|---|---|---|
| `scheduled-publish` | `publish` (delayed, jobId `article-<id>`) | `scheduleArticle` | `processScheduledPublish` | Reschedule = remove + re-add; publish/unpublish cancels. 3 attempts |
| `scheduled-publish` | `sweep` (job scheduler, every 60 s) | worker startup (`upsertJobScheduler`) | `sweepScheduled` | Publishes overdue scheduled articles whose job was lost |
| `revalidate` | `article` | publish, edit of published, unpublish | `processRevalidate` | POSTs `{ tags: ['article:<id>', 'homepage', 'articles'] }` with `x-revalidate-secret` to `WEB_REVALIDATE_URL` (the web's `/api/revalidate`); skipped when unset. 5 attempts, exponential backoff |
| `revalidate` | `tags` (`{ tags }`) | `enqueueRevalidate(tags)`: homepage layout saved, and admin data edits via `revalidateAfterCommit` (`lib/revalidate.ts`) | `processRevalidate` | Same endpoint and retries; job data carries the tags. An empty list enqueues nothing |
| `push` | `article` | publish | `processPush` | **Placeholder** |
| `search-index` | `article` | publish, edit of published, unpublish | `processSearchIndex` | **Placeholder** |
| `media-variants` | `variants` (jobId `media-<id>`) | media confirm | `processMediaVariants` | sharp WebP variants; concurrency 1; 3 attempts, then the row is marked `failed` ([media](media.md)) |

**Idempotency**: processors re-check the database. `publishIfDue` locks the article row (`FOR UPDATE`) and publishes only if it is still `scheduled`, the job's `scheduledAt` matches (stale jobs after a reschedule do nothing), and it is due (5 s early tolerance). The publish revision is attributed to whoever scheduled it (sweep: the last `schedule` revision's editor, else the author). Media processing skips rows that are already `ready`.

**Web cache tags** (names shared with `apps/web/src/lib/cache-tags.ts`): `homepage`, `articles`, `people`, `parliament`, `article:{id}`, `person:{id}`. Which admin change sends which tag is listed in [public-site](public-site.md#revalidation-srcappapirevalidateroutets). `revalidateAfterCommit(app, tags)` is called in route handlers after the service returns (so after commit); it logs and swallows enqueue errors, because the data is saved and the pages' time-based revalidation is the fallback. Imports send tags only when not `dryRun`.

Workers start in `server.ts` when `WORKERS_ENABLED=true` (`jobs/workers.ts` → `registerWorkers`), before `listen()`, and close on app shutdown. To split later: run the same build twice, API with `WORKERS_ENABLED=false`, worker with `true`.

## Tech used

bullmq 6 with ioredis. BullMQ needs its own connection with `maxRetriesPerRequest: null`; the app's Redis client stays fail-fast for rate limiting and health checks.

## How to start

Workers run automatically with `pnpm dev`. Inspect queues in Redis:

```bash
docker exec news-v2-redis-1 redis-cli -n 0 ZRANGE bull:scheduled-publish:delayed 0 -1
docker exec news-v2-redis-1 redis-cli -n 0 KEYS 'bull:*' | head
```

## How to maintain

- **New job**: add the queue name to `QUEUES` and a method to the `Jobs` interface (`types.ts`); implement it in `queue.ts`; add it to the test fake (`test/fake-jobs.ts`); write the processor as a plain function in `jobs/processors/` that re-checks DB state; register a `Worker` in `workers.ts`.
- **Tests**: route/service tests inject `createFakeJobs()` and assert recorded calls; processors are tested directly against the test DB (`processors.test.ts`, `media-variants.test.ts`); `queue.test.ts` checks real BullMQ scheduling/cancellation on Redis db 15.

## Notables

- Enqueue after commit, never inside the transaction — otherwise a rolled-back change can still trigger a job.
- A job that fires for a rescheduled or unpublished article is harmless by design; do not "fix" that by removing the DB re-check.
- There is no Bull Board / queue dashboard yet.
- Real push/search implementations and a CDN purge next to tag revalidation are follow-ups.

## Key files

`apps/api/src/jobs/{types,queue,workers}.ts`, `apps/api/src/jobs/processors/*.ts`, `apps/api/src/plugins/jobs.ts`, `apps/api/src/test/fake-jobs.ts`.

---
Last updated: 2026-10-07 — `enqueueRevalidate(tags)` replaces `enqueueHomepageChanged`; `home` tag renamed `homepage`, articles also send `articles`; data edits revalidate person/people/parliament tags.
