import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../app';
import { articleRevisions, articles } from '../db/schema/index';
import { buildTestApp } from '../test/app';
import { insertArticle } from '../test/articles';
import { createTestUser } from '../test/factories';
import { createFakeJobs } from '../test/fake-jobs';
import { resetDb } from '../test/reset-db';
import { processRevalidate } from './processors/revalidate';
import { processScheduledPublish, sweepScheduled, type ProcessorDeps } from './processors/scheduled-publish';

const jobs = createFakeJobs();
let app: App;
let deps: ProcessorDeps;

beforeAll(async () => {
  app = await buildTestApp({ jobs });
  deps = { db: app.db, jobs, log: app.log };
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  jobs.reset();
});

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);

async function statusOf(id: number) {
  const [row] = await app.db.select().from(articles).where(eq(articles.id, id));
  return row!;
}

describe('processScheduledPublish', () => {
  it('publishes a due scheduled article, attributed to the scheduler', async () => {
    const author = await createTestUser(app.db, { role: 'reporter', password: null });
    const scheduler = await createTestUser(app.db, { role: 'editor', password: null });
    const scheduledAt = minutesAgo(0);
    const article = await insertArticle(app, author.id, 'scheduled', { scheduledAt, isBreaking: true });

    const outcome = await processScheduledPublish(deps, {
      articleId: article.id,
      scheduledAt: scheduledAt.toISOString(),
      scheduledBy: scheduler.id,
    });

    expect(outcome).toBe('published');
    const row = await statusOf(article.id);
    expect(row).toMatchObject({ status: 'published', scheduledAt: null });
    expect(row.publishedAt).toBeInstanceOf(Date);
    const [revision] = await app.db.select().from(articleRevisions).where(eq(articleRevisions.articleId, article.id));
    expect(revision).toMatchObject({ kind: 'publish', editorId: scheduler.id });
    expect(jobs.calls).toEqual([{ type: 'enqueuePublished', articleId: article.id, isBreaking: true }]);
  });

  it.each([
    ['unpublished (back to draft)', 'draft' as const],
    ['already published', 'published' as const],
  ])('does nothing if the article was %s', async (_label, status) => {
    const author = await createTestUser(app.db, { password: null });
    const article = await insertArticle(app, author.id, status);

    const outcome = await processScheduledPublish(deps, {
      articleId: article.id,
      scheduledAt: minutesAgo(1).toISOString(),
      scheduledBy: author.id,
    });

    expect(outcome).toBe('skipped');
    expect((await statusOf(article.id)).status).toBe(status);
    expect(jobs.calls).toEqual([]);
  });

  it('does nothing for a stale job after rescheduling', async () => {
    const author = await createTestUser(app.db, { password: null });
    const newTime = minutesAgo(0);
    const article = await insertArticle(app, author.id, 'scheduled', { scheduledAt: newTime });

    const outcome = await processScheduledPublish(deps, {
      articleId: article.id,
      scheduledAt: minutesAgo(10).toISOString(),
      scheduledBy: author.id,
    });

    expect(outcome).toBe('skipped');
    expect((await statusOf(article.id)).status).toBe('scheduled');
  });

  it('does nothing if fired well before the scheduled time', async () => {
    const author = await createTestUser(app.db, { password: null });
    const future = new Date(Date.now() + 10 * 60_000);
    const article = await insertArticle(app, author.id, 'scheduled', { scheduledAt: future });

    const outcome = await processScheduledPublish(deps, {
      articleId: article.id,
      scheduledAt: future.toISOString(),
      scheduledBy: author.id,
    });

    expect(outcome).toBe('skipped');
  });
});

describe('sweepScheduled', () => {
  it('publishes overdue scheduled articles only, attributed to whoever scheduled them', async () => {
    const author = await createTestUser(app.db, { role: 'reporter', password: null });
    const scheduler = await createTestUser(app.db, { role: 'editor', password: null });
    const overdueA = await insertArticle(app, author.id, 'scheduled', { scheduledAt: minutesAgo(5) });
    const overdueB = await insertArticle(app, author.id, 'scheduled', { scheduledAt: minutesAgo(2) });
    const future = await insertArticle(app, author.id, 'scheduled', { scheduledAt: new Date(Date.now() + 3_600_000) });
    const draft = await insertArticle(app, author.id, 'draft');
    await app.db.insert(articleRevisions).values({
      articleId: overdueA.id,
      kind: 'schedule',
      editorId: scheduler.id,
      snapshot: {},
    });

    const published = await sweepScheduled(deps);

    expect(published).toBe(2);
    expect((await statusOf(overdueA.id)).status).toBe('published');
    expect((await statusOf(overdueB.id)).status).toBe('published');
    expect((await statusOf(future.id)).status).toBe('scheduled');
    expect((await statusOf(draft.id)).status).toBe('draft');

    const publishRevisions = await app.db
      .select({ articleId: articleRevisions.articleId, editorId: articleRevisions.editorId })
      .from(articleRevisions)
      .where(eq(articleRevisions.kind, 'publish'))
      .orderBy(asc(articleRevisions.articleId));
    expect(publishRevisions).toEqual([
      { articleId: overdueA.id, editorId: scheduler.id }, // from the schedule revision
      { articleId: overdueB.id, editorId: author.id }, // fallback: author
    ]);
  });
});

describe('processRevalidate', () => {
  const log = { info: vi.fn() } as unknown as App['log'];

  it('skips when WEB_REVALIDATE_URL is not configured', async () => {
    const fetchMock = vi.fn<typeof fetch>();

    const outcome = await processRevalidate({ env: {}, log, fetch: fetchMock }, { articleId: 1 });

    expect(outcome).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts tags with the secret header', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const env = { WEB_REVALIDATE_URL: 'http://web.test/api/revalidate', WEB_REVALIDATE_SECRET: 's'.repeat(32) };

    const outcome = await processRevalidate({ env, log, fetch: fetchMock }, { articleId: 7 });

    expect(outcome).toBe('sent');
    const [target, init] = fetchMock.mock.calls[0]!;
    expect(target).toBe('http://web.test/api/revalidate');
    expect(new Headers(init?.headers).get('x-revalidate-secret')).toBe('s'.repeat(32));
    expect(JSON.parse(String(init?.body))).toEqual({ tags: ['article:7', 'home'] });
  });

  it('posts explicit tags (homepage changes)', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
    const env = { WEB_REVALIDATE_URL: 'http://web.test/api/revalidate', WEB_REVALIDATE_SECRET: 's'.repeat(32) };

    await processRevalidate({ env, log, fetch: fetchMock }, { tags: ['home'] });

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ tags: ['home'] });
  });

  it('throws on a non-2xx response so BullMQ retries', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    const env = { WEB_REVALIDATE_URL: 'http://web.test/api/revalidate', WEB_REVALIDATE_SECRET: 's'.repeat(32) };

    await expect(processRevalidate({ env, log, fetch: fetchMock }, { articleId: 7 })).rejects.toThrow('HTTP 503');
  });
});
