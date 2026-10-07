import { articleResponseSchema, errorResponseSchema, type Article, type ArticleStatus } from '@news/shared/schemas';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { articleRevisions, articles, corrections, media } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { BODY, EMPTY_BODY, insertArticle } from '../../test/articles';
import { createFakeJobs } from '../../test/fake-jobs';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

const jobs = createFakeJobs();
let app: App;
let editor: TestActor;
let reporter: TestActor;

beforeAll(async () => {
  app = await buildTestApp({ jobs });
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  jobs.reset();
  editor = await signIn(app, 'editor');
  reporter = await signIn(app, 'reporter');
});

async function call(actor: TestActor, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as object | undefined, cookies: actor.cookies, headers: actor.headers });
}

async function ok(actor: TestActor, method: 'POST' | 'PATCH', url: string, payload?: unknown): Promise<Article> {
  const res = await call(actor, method, url, payload);
  expect(res.statusCode, res.body).toBeLessThan(300);
  return articleResponseSchema.parse(res.json()).data;
}

function errorCode(res: { json: () => unknown }) {
  return errorResponseSchema.parse(res.json()).error.code;
}

async function revisionKinds(articleId: number) {
  const rows = await app.db
    .select({ kind: articleRevisions.kind, editorId: articleRevisions.editorId, snapshot: articleRevisions.snapshot })
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, articleId))
    .orderBy(asc(articleRevisions.id));
  return rows;
}

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000);
const url = (id: number, action = '') => `/v1/admin/articles/${id}${action ? `/${action}` : ''}`;

describe('create and update', () => {
  it('creates a draft with a slug from the Mongolian title and a create revision', async () => {
    const article = await ok(reporter, 'POST', '/v1/admin/articles', { title: 'Төсвийн хэлэлцүүлэг эхэллээ', bodyJson: BODY });

    expect(article).toMatchObject({ status: 'draft', slug: 'tosviin-kheleltsuuleg-ekhellee', authorId: reporter.user.id });
    expect(await revisionKinds(article.id)).toEqual([expect.objectContaining({ kind: 'create', editorId: reporter.user.id })]);
  });

  it('deduplicates generated slugs and rejects a taken explicit slug', async () => {
    const first = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Ижил гарчиг', bodyJson: BODY });
    const second = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Ижил гарчиг', bodyJson: BODY });
    const taken = await call(editor, 'POST', '/v1/admin/articles', { title: 'x', slug: first.slug, bodyJson: BODY });

    expect(first.slug).toBe('ijil-garchig');
    expect(second.slug).toBe('ijil-garchig-2');
    expect(taken.statusCode).toBe(409);
    expect(errorCode(taken)).toBe('SLUG_TAKEN');
  });

  it('writes an update revision and re-renders HTML on every save', async () => {
    const article = await ok(reporter, 'POST', '/v1/admin/articles', { title: 'Эх', bodyJson: BODY });
    const newBody = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Шинэ' }] }] };

    const updated = await ok(reporter, 'PATCH', url(article.id), { title: 'Шинэчилсэн', bodyJson: newBody });
    await ok(reporter, 'PATCH', url(article.id), { lede: 'Товч' });

    expect(updated.bodyHtml).toBe('<h2>Шинэ</h2>');
    expect((await revisionKinds(article.id)).map((r) => r.kind)).toEqual(['create', 'update', 'update']);
    expect(jobs.calls).toEqual([]);
  });

  it('rejects an empty update and a slug taken by another article', async () => {
    const a = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Нэг', bodyJson: BODY });
    const b = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Хоёр', bodyJson: BODY });

    const empty = await call(editor, 'PATCH', url(a.id), {});
    const conflict = await call(editor, 'PATCH', url(b.id), { slug: a.slug });
    const sameSlug = await call(editor, 'PATCH', url(a.id), { slug: a.slug, title: 'Нэг!' });

    expect(empty.statusCode).toBe(400);
    expect(conflict.statusCode).toBe(409);
    expect(errorCode(conflict)).toBe('SLUG_TAKEN');
    expect(sameSlug.statusCode).toBe(200);
  });
});

describe('published edits (corrections log)', () => {
  it('requires edit.type', async () => {
    const article = await insertArticle(app, reporter.user.id, 'published');

    const res = await call(editor, 'PATCH', url(article.id), { title: 'Засвар' });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('CORRECTION_REQUIRED');
    expect(await revisionKinds(article.id)).toEqual([]);
  });

  it('minor edit: no correction row, enqueues revalidation', async () => {
    const article = await insertArticle(app, reporter.user.id, 'published');

    await ok(editor, 'PATCH', url(article.id), { title: 'Үсгийн алдаа зассан', edit: { type: 'minor' } });

    expect(await app.db.select().from(corrections)).toHaveLength(0);
    expect(jobs.calls).toEqual([{ type: 'enqueueChanged', articleId: article.id }]);
    expect((await revisionKinds(article.id))[0]?.snapshot).toMatchObject({ editType: 'minor' });
  });

  it('substantive edit: writes a public correction in the same transaction', async () => {
    const article = await insertArticle(app, reporter.user.id, 'published');

    await ok(editor, 'PATCH', url(article.id), {
      bodyJson: BODY,
      edit: { type: 'substantive', correction: { description: 'Тоог зассан', reason: 'Буруу тоо' } },
    });

    const [row] = await app.db.select().from(corrections);
    expect(row).toMatchObject({
      entityType: 'article',
      entityId: article.id,
      description: 'Тоог зассан',
      reason: 'Буруу тоо',
      createdBy: editor.user.id,
    });
  });
});

describe('valid transitions', () => {
  it('submit: draft → in_review', async () => {
    const article = await insertArticle(app, reporter.user.id, 'draft');

    const result = await ok(reporter, 'POST', url(article.id, 'submit'));

    expect(result.status).toBe('in_review');
    expect((await revisionKinds(article.id)).map((r) => r.kind)).toEqual(['submit']);
  });

  it('return-to-draft: in_review → draft, note kept in the revision', async () => {
    const article = await insertArticle(app, reporter.user.id, 'in_review');

    const result = await ok(editor, 'POST', url(article.id, 'return-to-draft'), { note: 'Эх сурвалж нэм' });

    expect(result.status).toBe('draft');
    const [revision] = await revisionKinds(article.id);
    expect(revision).toMatchObject({ kind: 'return_to_draft', editorId: editor.user.id });
    expect(revision?.snapshot).toMatchObject({ note: 'Эх сурвалж нэм' });
  });

  it.each<ArticleStatus>(['draft', 'in_review'])('publish from %s: sets published_at and enqueues effects', async (from) => {
    const article = await insertArticle(app, reporter.user.id, from, { isBreaking: true });

    const result = await ok(editor, 'POST', url(article.id, 'publish'));

    expect(result.status).toBe('published');
    expect(result.publishedAt).not.toBeNull();
    expect(result.scheduledAt).toBeNull();
    expect((await revisionKinds(article.id)).map((r) => r.kind)).toEqual(['publish']);
    expect(jobs.calls).toEqual([{ type: 'enqueuePublished', articleId: article.id, isBreaking: true }]);
  });

  it('publish from scheduled cancels the scheduled job', async () => {
    const article = await insertArticle(app, reporter.user.id, 'scheduled');

    await ok(editor, 'POST', url(article.id, 'publish'));

    expect(jobs.calls).toEqual([
      { type: 'cancelScheduledPublish', articleId: article.id },
      { type: 'enqueuePublished', articleId: article.id, isBreaking: false },
    ]);
  });

  it('republishing keeps the original published_at', async () => {
    const article = await insertArticle(app, reporter.user.id, 'draft');
    const first = await ok(editor, 'POST', url(article.id, 'publish'));
    await ok(editor, 'POST', url(article.id, 'unpublish'));

    const again = await ok(editor, 'POST', url(article.id, 'publish'));

    expect(again.publishedAt).toBe(first.publishedAt);
  });

  it.each<ArticleStatus>(['draft', 'in_review'])('schedule from %s: stores scheduled_at and adds a delayed job', async (from) => {
    const article = await insertArticle(app, reporter.user.id, from);
    const at = inMinutes(30);

    const result = await ok(editor, 'POST', url(article.id, 'schedule'), { scheduledAt: at.toISOString() });

    expect(result).toMatchObject({ status: 'scheduled', scheduledAt: at.toISOString() });
    expect(jobs.calls).toEqual([{ type: 'schedulePublish', articleId: article.id, at, scheduledBy: editor.user.id }]);
    expect((await revisionKinds(article.id)).map((r) => r.kind)).toEqual(['schedule']);
  });

  it('rescheduling replaces the job with the new time', async () => {
    const article = await insertArticle(app, reporter.user.id, 'draft');
    const first = inMinutes(30);
    const second = inMinutes(90);
    await ok(editor, 'POST', url(article.id, 'schedule'), { scheduledAt: first.toISOString() });

    const result = await ok(editor, 'POST', url(article.id, 'schedule'), { scheduledAt: second.toISOString() });

    expect(result.scheduledAt).toBe(second.toISOString());
    expect(jobs.calls.map((c) => c.type)).toEqual(['schedulePublish', 'schedulePublish']);
    expect(jobs.calls[1]).toMatchObject({ at: second });
  });

  it('unpublish from published: → draft, keeps published_at, enqueues revalidation', async () => {
    const article = await insertArticle(app, reporter.user.id, 'published');

    const result = await ok(editor, 'POST', url(article.id, 'unpublish'));

    expect(result.status).toBe('draft');
    expect(result.publishedAt).toBe(article.publishedAt!.toISOString());
    expect(jobs.calls).toEqual([{ type: 'enqueueChanged', articleId: article.id }]);
  });

  it('unpublish from scheduled: → draft, clears scheduled_at, cancels the job', async () => {
    const article = await insertArticle(app, reporter.user.id, 'scheduled');

    const result = await ok(editor, 'POST', url(article.id, 'unpublish'));

    expect(result).toMatchObject({ status: 'draft', scheduledAt: null });
    expect(jobs.calls).toEqual([{ type: 'cancelScheduledPublish', articleId: article.id }]);
  });
});

describe('invalid transitions → 409', () => {
  const INVALID: [string, ArticleStatus][] = [
    ['submit', 'in_review'],
    ['submit', 'scheduled'],
    ['submit', 'published'],
    ['submit', 'archived'],
    ['return-to-draft', 'draft'],
    ['return-to-draft', 'scheduled'],
    ['return-to-draft', 'published'],
    ['publish', 'published'],
    ['publish', 'archived'],
    ['schedule', 'published'],
    ['schedule', 'archived'],
    ['unpublish', 'draft'],
    ['unpublish', 'in_review'],
    ['unpublish', 'archived'],
  ];

  it.each(INVALID)('%s from %s', async (action, from) => {
    const article = await insertArticle(app, reporter.user.id, from);
    const payload = action === 'schedule' ? { scheduledAt: inMinutes(30).toISOString() } : undefined;

    const res = await call(editor, 'POST', url(article.id, action), payload);

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('INVALID_STATUS_TRANSITION');
    const [after] = await app.db.select().from(articles).where(eq(articles.id, article.id));
    expect(after?.status).toBe(from);
    expect(jobs.calls).toEqual([]);
  });
});

describe('publish/schedule guards', () => {
  it('rejects scheduling in the past', async () => {
    const article = await insertArticle(app, reporter.user.id, 'draft');

    const res = await call(editor, 'POST', url(article.id, 'schedule'), { scheduledAt: inMinutes(-1).toISOString() });

    expect(res.statusCode).toBe(400);
  });

  it.each(['publish', 'schedule'])('refuses to %s an empty article', async (action) => {
    const article = await insertArticle(app, reporter.user.id, 'draft', { bodyJson: EMPTY_BODY, bodyHtml: '<p></p>' });
    const payload = action === 'schedule' ? { scheduledAt: inMinutes(30).toISOString() } : undefined;

    const res = await call(editor, 'POST', url(article.id, action), payload);

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });
});

describe('revisions', () => {
  it('lists newest first and restores content without changing status', async () => {
    const article = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Анхны', bodyJson: BODY });
    await ok(editor, 'PATCH', url(article.id), { title: 'Хоёр дахь' });
    await ok(editor, 'POST', url(article.id, 'submit'));

    const list = (await call(editor, 'GET', url(article.id, 'revisions'))).json() as {
      data: { id: number; kind: string; snapshot: { title: string } }[];
    };
    expect(list.data.map((r) => r.kind)).toEqual(['submit', 'update', 'create']);

    const createRevision = list.data[2]!;
    const restored = await ok(editor, 'POST', `${url(article.id, 'revisions')}/${createRevision.id}/restore`);

    expect(restored).toMatchObject({ title: 'Анхны', status: 'in_review' });
    const latest = (await revisionKinds(article.id)).at(-1);
    expect(latest).toMatchObject({ kind: 'restore' });
    expect(latest?.snapshot).toMatchObject({ restoredFrom: createRevision.id });
  });

  it('restoring onto a published article follows the correction rule', async () => {
    const article = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Анхны', bodyJson: BODY });
    await ok(editor, 'PATCH', url(article.id), { title: 'Хоёр дахь' });
    await ok(editor, 'POST', url(article.id, 'publish'));
    const [createRevision] = await app.db
      .select()
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, article.id))
      .orderBy(asc(articleRevisions.id))
      .limit(1);
    const restoreUrl = `${url(article.id, 'revisions')}/${createRevision!.id}/restore`;

    const missing = await call(editor, 'POST', restoreUrl);
    const minor = await call(editor, 'POST', restoreUrl, { edit: { type: 'minor' } });

    expect(missing.statusCode).toBe(400);
    expect(errorCode(missing)).toBe('CORRECTION_REQUIRED');
    expect(minor.statusCode).toBe(200);
  });

  it('returns 404 for a revision of another article', async () => {
    const a = await ok(editor, 'POST', '/v1/admin/articles', { title: 'A', bodyJson: BODY });
    const b = await ok(editor, 'POST', '/v1/admin/articles', { title: 'B', bodyJson: BODY });
    const [revisionOfB] = await app.db.select().from(articleRevisions).where(eq(articleRevisions.articleId, b.id));

    const res = await call(editor, 'POST', `${url(a.id, 'revisions')}/${revisionOfB!.id}/restore`);

    expect(res.statusCode).toBe(404);
    expect(errorCode(res)).toBe('REVISION_NOT_FOUND');
  });
});

describe('cover media rule', () => {
  async function mediaRow(values: { status?: 'ready' | 'pending' | 'processing' | 'failed'; alt?: string | null; credit?: string | null }) {
    const [row] = await app.db
      .insert(media)
      .values({
        r2Key: `originals/test/${Math.random().toString(36).slice(2)}.jpg`,
        mime: 'image/jpeg',
        status: values.status ?? 'ready',
        alt: values.alt === undefined ? 'Төрийн ордон' : values.alt,
        credit: values.credit === undefined ? 'Б.Сараа' : values.credit,
      })
      .returning();
    return row!;
  }

  it.each([
    ['pending', { status: 'pending' as const }, 'pending, not ready'],
    ['processing', { status: 'processing' as const }, 'processing, not ready'],
    ['failed', { status: 'failed' as const }, 'failed, not ready'],
    ['missing alt', { alt: null }, 'alt text is missing'],
    ['blank credit', { credit: '   ' }, 'credit is missing'],
  ])('rejects a %s cover', async (_label, values, message) => {
    const cover = await mediaRow(values);

    const res = await call(editor, 'POST', '/v1/admin/articles', { title: 'Нүүр зураг', bodyJson: BODY, coverMediaId: cover.id });

    expect(res.statusCode).toBe(400);
    expect(errorResponseSchema.parse(res.json()).error).toMatchObject({ code: 'MEDIA_NOT_USABLE', message: expect.stringContaining(message) });
  });

  it('rejects an unknown cover id', async () => {
    const res = await call(editor, 'POST', '/v1/admin/articles', { title: 'x', bodyJson: BODY, coverMediaId: 999_999 });

    expect(errorCode(res)).toBe('MEDIA_NOT_USABLE');
  });

  it('accepts a ready cover with alt and credit, on create and update', async () => {
    const first = await mediaRow({});
    const second = await mediaRow({});

    const created = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Зурагтай', bodyJson: BODY, coverMediaId: first.id });
    const updated = await ok(editor, 'PATCH', url(created.id), { coverMediaId: second.id });

    expect(created.coverMediaId).toBe(first.id);
    expect(updated.coverMediaId).toBe(second.id);
  });

  it('restoring a revision whose cover no longer qualifies is rejected', async () => {
    const original = await mediaRow({});
    const replacement = await mediaRow({});
    const created = await ok(editor, 'POST', '/v1/admin/articles', { title: 'Зурагтай', bodyJson: BODY, coverMediaId: original.id });
    await ok(editor, 'PATCH', url(created.id), { coverMediaId: replacement.id });
    // The old cover lost its credit after it stopped being used as a cover.
    await app.db.update(media).set({ credit: null }).where(eq(media.id, original.id));
    const [createRevision] = await app.db
      .select()
      .from(articleRevisions)
      .where(eq(articleRevisions.articleId, created.id))
      .orderBy(asc(articleRevisions.id))
      .limit(1);

    const res = await call(editor, 'POST', `${url(created.id, 'revisions')}/${createRevision!.id}/restore`);

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('MEDIA_NOT_USABLE');
  });
});
