import { articleResponseSchema, articleRevisionListResponseSchema, errorResponseSchema } from '@news/shared/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { articleRevisions, persons, tags } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { BODY, insertArticle } from '../../test/articles';
import { seedRefs, type Refs } from '../../test/political';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let reporter: TestActor;
let editor: TestActor;
let refs: Refs;
let tagId: number;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  reporter = await signIn(app, 'reporter');
  editor = await signIn(app, 'editor');
  refs = await seedRefs(app);
  const [tag] = await app.db.insert(tags).values({ slug: 'songuul', nameMn: 'Сонгууль' }).returning();
  tagId = tag!.id;
});

function call(actor: TestActor, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as Record<string, unknown> | undefined, cookies: actor.cookies, headers: actor.headers });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;

async function revisions(articleId: number) {
  const res = await call(editor, 'GET', `/v1/admin/articles/${articleId}/revisions?pageSize=100`);
  return articleRevisionListResponseSchema.parse(res.json()).data;
}

describe('article links (tags, persons, organizations, bills)', () => {
  it('sets links on create and returns them', async () => {
    const res = await call(reporter, 'POST', '/v1/admin/articles', {
      title: 'Холбоостой мэдээ',
      bodyJson: BODY,
      tagIds: [tagId],
      personIds: [refs.personB.id, refs.personA.id],
      organizationIds: [refs.party.id],
      billIds: [refs.bill.id],
    });

    expect(res.statusCode).toBe(201);
    const article = articleResponseSchema.parse(res.json()).data;
    expect(article).toMatchObject({
      tagIds: [tagId],
      personIds: [refs.personA.id, refs.personB.id].sort((a, b) => a - b),
      organizationIds: [refs.party.id],
      billIds: [refs.bill.id],
    });
    const [created] = await revisions(article.id);
    expect(created?.snapshot).toMatchObject({ tagIds: [tagId], billIds: [refs.bill.id] });
  });

  it('replaces only the arrays that are sent', async () => {
    const row = await insertArticle(app, reporter.user.id);
    await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { personIds: [refs.personA.id], tagIds: [tagId] });

    const res = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { personIds: [refs.personB.id] });

    expect(res.statusCode).toBe(200);
    expect(articleResponseSchema.parse(res.json()).data).toMatchObject({ personIds: [refs.personB.id], tagIds: [tagId] });
    const get = await call(reporter, 'GET', `/v1/admin/articles/${row.id}`);
    expect(articleResponseSchema.parse(get.json()).data.personIds).toEqual([refs.personB.id]);
  });

  it('rejects unknown and soft-deleted targets without writing anything', async () => {
    const row = await insertArticle(app, reporter.user.id);
    await app.db.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, refs.personB.id));

    const unknown = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { title: 'Шинэ', billIds: [999999] });
    const deleted = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { personIds: [refs.personB.id] });

    expect(unknown.statusCode).toBe(400);
    expect(errorCode(unknown)).toBe('REFERENCE_NOT_FOUND');
    expect(deleted.statusCode).toBe(400);
    expect(errorCode(deleted)).toBe('REFERENCE_NOT_FOUND');
    const get = articleResponseSchema.parse((await call(reporter, 'GET', `/v1/admin/articles/${row.id}`)).json()).data;
    expect(get).toMatchObject({ title: row.title, billIds: [], personIds: [] });
  });

  it('rejects duplicate ids in a list', async () => {
    const row = await insertArticle(app, reporter.user.id);
    const res = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { tagIds: [tagId, tagId] });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('restoring a revision restores its links', async () => {
    const row = await insertArticle(app, reporter.user.id);
    await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { personIds: [refs.personA.id] });
    const [withPersonA] = await revisions(row.id);
    await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { personIds: [refs.personB.id], billIds: [refs.bill.id] });

    const res = await call(reporter, 'POST', `/v1/admin/articles/${row.id}/revisions/${withPersonA!.id}/restore`);

    expect(res.statusCode).toBe(200);
    expect(articleResponseSchema.parse(res.json()).data).toMatchObject({ personIds: [refs.personA.id], billIds: [] });
  });
});

describe('autosave', () => {
  it('coalesces autosaves by the same editor within 5 minutes into one revision', async () => {
    const row = await insertArticle(app, reporter.user.id);

    const first = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { title: 'Ноорог 1', autosave: true });
    const second = await call(reporter, 'PATCH', `/v1/admin/articles/${row.id}`, { title: 'Ноорог 2', autosave: true });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const list = await revisions(row.id);
    expect(list.map((r) => r.kind)).toEqual(['autosave']);
    expect(list[0]?.snapshot.title).toBe('Ноорог 2');
  });

  it('starts a new autosave revision after 5 minutes, after a manual save, or for another editor', async () => {
    const row = await insertArticle(app, reporter.user.id, 'in_review');
    const url = `/v1/admin/articles/${row.id}`;

    await call(editor, 'PATCH', url, { title: 'A', autosave: true });
    await app.db.update(articleRevisions).set({ createdAt: sql`now() - interval '6 minutes'` }).where(eq(articleRevisions.articleId, row.id));
    await call(editor, 'PATCH', url, { title: 'B', autosave: true }); // older than 5 min → new row
    await call(editor, 'PATCH', url, { title: 'C' }); // manual save → update
    await call(editor, 'PATCH', url, { title: 'D', autosave: true }); // latest is not an autosave → new row

    const admin = await signIn(app, 'admin');
    await call(admin, 'PATCH', url, { title: 'E', autosave: true }); // another editor → new row

    expect((await revisions(row.id)).map((r) => [r.kind, r.snapshot.title])).toEqual([
      ['autosave', 'E'],
      ['autosave', 'D'],
      ['update', 'C'],
      ['autosave', 'B'],
      ['autosave', 'A'],
    ]);
  });

  it('is refused for published articles (they need an explicit edit type)', async () => {
    const row = await insertArticle(app, reporter.user.id, 'published');

    const res = await call(editor, 'PATCH', `/v1/admin/articles/${row.id}`, { title: 'Шинэ', autosave: true, edit: { type: 'minor' } });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });
});

describe('edit conflicts', () => {
  it('returns 409 EDIT_CONFLICT when expectedUpdatedAt is stale', async () => {
    const row = await insertArticle(app, reporter.user.id, 'in_review');
    const url = `/v1/admin/articles/${row.id}`;
    const loaded = articleResponseSchema.parse((await call(editor, 'GET', url)).json()).data;

    const firstSave = await call(editor, 'PATCH', url, { title: 'Эхний', expectedUpdatedAt: loaded.updatedAt });
    const staleSave = await call(editor, 'PATCH', url, { title: 'Хуучин', expectedUpdatedAt: loaded.updatedAt });

    expect(firstSave.statusCode).toBe(200);
    expect(staleSave.statusCode).toBe(409);
    expect(errorCode(staleSave)).toBe('EDIT_CONFLICT');
    const freshSave = await call(editor, 'PATCH', url, {
      title: 'Шинэ',
      expectedUpdatedAt: articleResponseSchema.parse(firstSave.json()).data.updatedAt,
    });
    expect(freshSave.statusCode).toBe(200);
  });
});

describe('editor nodes in the body', () => {
  it('stores allowlisted embeds as iframes in bodyHtml and rejects other URLs', async () => {
    const row = await insertArticle(app, reporter.user.id);
    const url = `/v1/admin/articles/${row.id}`;

    const ok = await call(reporter, 'PATCH', url, {
      bodyJson: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Видео:' }] },
          { type: 'embed', attrs: { provider: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } },
        ],
      },
    });
    const bad = await call(reporter, 'PATCH', url, {
      bodyJson: { type: 'doc', content: [{ type: 'embed', attrs: { provider: 'youtube', url: 'https://evil.example/watch?v=dQw4w9WgXcQ' } }] },
    });

    expect(ok.statusCode).toBe(200);
    expect(articleResponseSchema.parse(ok.json()).data.bodyHtml).toContain(
      '<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"',
    );
    expect(bad.statusCode).toBe(400);
    expect(errorCode(bad)).toBe('VALIDATION_ERROR');
  });
});
