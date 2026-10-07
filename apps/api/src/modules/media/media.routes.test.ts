import { adminMediaListResponseSchema, adminMediaResponseSchema, errorResponseSchema, requestUploadResponseSchema, type UserRole } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { auditLog, media } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { insertArticle } from '../../test/articles';
import { createFakeJobs } from '../../test/fake-jobs';
import { makeJpeg, makePng } from '../../test/images';
import { createMemoryStorage } from '../../test/memory-storage';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

const storage = createMemoryStorage();
const jobs = createFakeJobs();
let app: App;
let reporter: TestActor;
let jpeg: Uint8Array;

beforeAll(async () => {
  app = await buildTestApp({ storage, jobs });
  await app.ready();
  jpeg = await makeJpeg(800, 600);
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  storage.reset();
  jobs.reset();
  reporter = await signIn(app, 'reporter');
});

function call(actor: TestActor | null, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as object | undefined, cookies: actor?.cookies, headers: actor?.headers });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;

async function requestUpload(actor: TestActor, overrides: Record<string, unknown> = {}) {
  const res = await call(actor, 'POST', '/v1/admin/media/uploads', {
    filename: 'хурал.jpg',
    mimeType: 'image/jpeg',
    byteSize: jpeg.length,
    alt: 'Төрийн ордон',
    credit: 'Б.Сараа',
    ...overrides,
  });
  expect(res.statusCode, res.body).toBe(201);
  return requestUploadResponseSchema.parse(res.json()).data;
}

async function statusOf(id: number) {
  const [row] = await app.db.select().from(media).where(eq(media.id, id));
  return row!;
}

describe('request upload', () => {
  it('creates a pending row under originals/ and presigns exact type and size', async () => {
    const { media: created, upload } = await requestUpload(reporter);

    expect(created).toMatchObject({ status: 'pending', mime: 'image/jpeg', byteSize: jpeg.length, originalFilename: 'хурал.jpg', variants: [] });
    expect(upload).toMatchObject({ method: 'PUT', headers: { 'content-type': 'image/jpeg' } });
    expect(storage.presigned).toEqual([
      expect.objectContaining({ bucket: 'test-originals', contentType: 'image/jpeg', contentLength: jpeg.length, expiresInSeconds: 600 }),
    ]);
    expect(storage.presigned[0]!.key).toMatch(/^originals\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
    const [audit] = await app.db.select().from(auditLog).where(eq(auditLog.entityType, 'media'));
    expect(audit).toMatchObject({ action: 'create', actorId: reporter.user.id });
  });

  it.each(['image/gif', 'image/svg+xml', 'image/heic', 'text/html'])('rejects %s', async (mimeType) => {
    const res = await call(reporter, 'POST', '/v1/admin/media/uploads', { filename: 'x', mimeType, byteSize: 10 });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('rejects files over MEDIA_MAX_BYTES', async () => {
    const res = await call(reporter, 'POST', '/v1/admin/media/uploads', { filename: 'big.jpg', mimeType: 'image/jpeg', byteSize: 1_048_577 });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('MEDIA_TOO_LARGE');
    expect(storage.presigned).toEqual([]);
  });

  it.each<UserRole>(['reporter', 'editor', 'admin', 'data_editor'])('%s can upload', async (role) => {
    await requestUpload(await signIn(app, role));
  });

  it('requires a session', async () => {
    expect((await call(null, 'POST', '/v1/admin/media/uploads', {})).statusCode).toBe(401);
  });

  it('returns 503 when storage is not configured', async () => {
    const bare = await buildTestApp({ storage: null });
    const actor = await signIn(bare, 'reporter');

    const res = await bare.inject({
      method: 'POST',
      url: '/v1/admin/media/uploads',
      payload: { filename: 'a.jpg', mimeType: 'image/jpeg', byteSize: 10 },
      cookies: actor.cookies,
      headers: actor.headers,
    });
    await bare.close();

    expect(res.statusCode).toBe(503);
  });
});

describe('confirm', () => {
  const confirm = (actor: TestActor, id: number) => call(actor, 'POST', `/v1/admin/media/${id}/confirm`);

  it('verifies the original, moves to processing and queues variants', async () => {
    const { media: created } = await requestUpload(reporter);
    storage.upload('test-originals', storage.presigned[0]!.key, jpeg, 'image/jpeg');

    const res = await confirm(reporter, created.id);

    expect(res.statusCode, res.body).toBe(200);
    expect(adminMediaResponseSchema.parse(res.json()).data.status).toBe('processing');
    expect(jobs.calls).toEqual([{ type: 'enqueueMediaVariants', mediaId: created.id }]);
  });

  it('stays pending (retryable) when the file has not been uploaded yet', async () => {
    const { media: created } = await requestUpload(reporter);

    const res = await confirm(reporter, created.id);

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('MEDIA_UPLOAD_INVALID');
    expect((await statusOf(created.id)).status).toBe('pending');
  });

  it('size mismatch → failed and the object is deleted', async () => {
    const { media: created } = await requestUpload(reporter);
    const key = storage.presigned[0]!.key;
    storage.upload('test-originals', key, jpeg.subarray(0, jpeg.length - 10), 'image/jpeg');

    const res = await confirm(reporter, created.id);

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('MEDIA_UPLOAD_INVALID');
    expect(await statusOf(created.id)).toMatchObject({ status: 'failed', processingError: expect.stringContaining('does not match') });
    expect(storage.objects.has(`test-originals/${key}`)).toBe(false);
    expect(jobs.calls).toEqual([]);
  });

  it('content that is not the declared type → failed (magic bytes)', async () => {
    const png = await makePng(40, 40);
    const { media: created } = await requestUpload(reporter, { byteSize: png.length });
    storage.upload('test-originals', storage.presigned[0]!.key, png, 'image/jpeg');

    const res = await confirm(reporter, created.id);

    expect(res.statusCode).toBe(400);
    expect((await statusOf(created.id)).processingError).toContain('image/png');
  });

  it('a renamed HTML file is rejected', async () => {
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const { media: created } = await requestUpload(reporter, { byteSize: html.length });
    storage.upload('test-originals', storage.presigned[0]!.key, html, 'image/jpeg');

    expect((await confirm(reporter, created.id)).statusCode).toBe(400);
  });

  it('only the uploader, editors and admins may confirm; not twice', async () => {
    const { media: created } = await requestUpload(reporter);
    storage.upload('test-originals', storage.presigned[0]!.key, jpeg, 'image/jpeg');

    const other = await confirm(await signIn(app, 'reporter'), created.id);
    const editor = await confirm(await signIn(app, 'editor'), created.id);
    const again = await confirm(reporter, created.id);

    expect(other.statusCode).toBe(403);
    expect(editor.statusCode).toBe(200);
    expect(again.statusCode).toBe(409);
  });
});

describe('library', () => {
  async function seedMedia(values: Array<{ alt: string | null; credit: string | null; status?: 'ready' | 'pending' }>) {
    return app.db
      .insert(media)
      .values(values.map((v, i) => ({ r2Key: `originals/test/${i}.jpg`, mime: 'image/jpeg', status: v.status ?? 'ready', alt: v.alt, credit: v.credit })))
      .returning();
  }

  it('searches alt or credit, filters status, paginates newest first', async () => {
    await seedMedia([
      { alt: 'Төрийн ордон өглөө', credit: 'Б.Сараа' },
      { alt: 'Сүхбаатарын талбай', credit: 'MONTSAME' },
      { alt: null, credit: 'Т.Гэрэл', status: 'pending' },
    ]);

    const list = async (query: string) =>
      adminMediaListResponseSchema.parse((await call(reporter, 'GET', `/v1/admin/media?${query}`)).json());

    expect((await list(`search=${encodeURIComponent('ордон')}`)).data.map((m) => m.alt)).toEqual(['Төрийн ордон өглөө']);
    expect((await list('search=montsame')).data.map((m) => m.credit)).toEqual(['MONTSAME']);
    expect((await list('status=pending')).data).toHaveLength(1);
    const page = await list('pageSize=2&page=2');
    expect(page.pagination).toEqual({ page: 2, pageSize: 2, total: 3, totalPages: 2 });
  });

  it('exposes variant URLs from MEDIA_PUBLIC_BASE_URL, never the original', async () => {
    const [row] = await seedMedia([{ alt: 'a', credit: 'b' }]);
    await app.db
      .update(media)
      .set({ variants: { w640: { key: `media/${row!.id}/w640.webp`, width: 640, height: 480 }, w320: { key: `media/${row!.id}/w320.webp`, width: 320, height: 240 } } })
      .where(eq(media.id, row!.id));

    const res = adminMediaResponseSchema.parse((await call(reporter, 'GET', `/v1/admin/media/${row!.id}`)).json()).data;

    expect(res.variants).toEqual([
      { width: 320, height: 240, url: `https://media.test/media/${row!.id}/w320.webp` },
      { width: 640, height: 480, url: `https://media.test/media/${row!.id}/w640.webp` },
    ]);
    expect(JSON.stringify(res)).not.toContain('originals/');
  });

  it('PATCH edits alt/credit (audited) but cannot clear them while used as a cover', async () => {
    const [row] = await seedMedia([{ alt: 'Хуучин', credit: 'Б.Сараа' }]);
    const updated = await call(reporter, 'PATCH', `/v1/admin/media/${row!.id}`, { alt: 'Шинэ тайлбар' });
    expect(adminMediaResponseSchema.parse(updated.json()).data.alt).toBe('Шинэ тайлбар');

    await insertArticle(app, reporter.user.id, 'draft', { coverMediaId: row!.id });
    const cleared = await call(reporter, 'PATCH', `/v1/admin/media/${row!.id}`, { credit: '  ' });

    expect(cleared.statusCode).toBe(409);
    expect(errorCode(cleared)).toBe('IN_USE');
  });
});
