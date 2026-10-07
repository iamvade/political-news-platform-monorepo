import { adminPromiseResponseSchema, adminPromiseUpdateListResponseSchema, errorResponseSchema, type UserRole } from '@news/shared/schemas';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { auditLog, promises } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { seedRefs, SRC, type Refs } from '../../test/political';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let refs: Refs;
let dataEditor: TestActor;
let promiseId: number;

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
  refs = await seedRefs(app);
  dataEditor = await signIn(app, 'data_editor');
  const [row] = await app.db
    .insert(promises)
    .values({ personId: refs.personA.id, textMn: 'Татварыг цахимжуулна.', madeOn: '2024-06-10', sourceUrl: SRC })
    .returning();
  promiseId = row!.id;
});

function call(actor: TestActor | null, method: 'GET' | 'POST' | 'PATCH', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as object | undefined, cookies: actor?.cookies, headers: actor?.headers });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;
const change = (overrides: Record<string, unknown> = {}) => ({
  status: 'in_progress',
  date: '2025-01-10',
  noteMn: 'Хуулийн төслийг УИХ-д өргөн барьсан.',
  sourceUrl: 'https://source.example/bill-submitted',
  ...overrides,
});

describe('POST /v1/admin/promises/:id/status', () => {
  it('records the decision, mirrors the status and stamps the review time', async () => {
    const res = await call(dataEditor, 'POST', `/v1/admin/promises/${promiseId}/status`, change());

    expect(res.statusCode, res.body).toBe(200);
    const promise = adminPromiseResponseSchema.parse(res.json()).data;
    expect(promise.status).toBe('in_progress');
    expect(promise.lastReviewedAt).not.toBeNull();

    const updates = adminPromiseUpdateListResponseSchema.parse((await call(dataEditor, 'GET', `/v1/admin/promises/${promiseId}/updates`)).json());
    expect(updates.data).toEqual([
      expect.objectContaining({
        promiseId,
        status: 'in_progress',
        date: '2025-01-10',
        noteMn: 'Хуулийн төслийг УИХ-д өргөн барьсан.',
        sourceUrl: 'https://source.example/bill-submitted',
        createdBy: dataEditor.user.id,
      }),
    ]);
    const [entry] = await app.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, 'promise'), eq(auditLog.entityId, promiseId)));
    expect(entry?.diff).toMatchObject({ status: { from: 'not_rated', to: 'in_progress' }, promiseUpdate: { status: 'in_progress' } });
  });

  it('keeps the history newest first and allows confirming the same status', async () => {
    await call(dataEditor, 'POST', `/v1/admin/promises/${promiseId}/status`, change());
    await call(dataEditor, 'POST', `/v1/admin/promises/${promiseId}/status`, change({ status: 'kept', date: '2025-04-17', noteMn: 'Хууль батлагдсан.' }));
    const confirm = await call(dataEditor, 'POST', `/v1/admin/promises/${promiseId}/status`, change({ status: 'kept', date: '2025-09-01', noteMn: 'Хэрэгжиж эхэлсэн.' }));

    expect(confirm.statusCode).toBe(200);
    const updates = adminPromiseUpdateListResponseSchema.parse((await call(dataEditor, 'GET', `/v1/admin/promises/${promiseId}/updates`)).json());
    expect(updates.data.map((u) => [u.date, u.status])).toEqual([
      ['2025-09-01', 'kept'],
      ['2025-04-17', 'kept'],
      ['2025-01-10', 'in_progress'],
    ]);
  });

  it.each([
    ['a missing note', { noteMn: undefined }],
    ['a blank note', { noteMn: '   ' }],
    ['a missing evidence link', { sourceUrl: undefined }],
    ['a non-http evidence link', { sourceUrl: 'ftp://source.example/x' }],
    ['an unknown status', { status: 'stalled' }],
    ['a bad date', { date: '2025-02-30' }],
  ])('rejects %s', async (_label, overrides) => {
    const res = await call(dataEditor, 'POST', `/v1/admin/promises/${promiseId}/status`, change(overrides));

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
    const [row] = await app.db.select().from(promises).where(eq(promises.id, promiseId));
    expect(row?.status).toBe('not_rated');
  });

  it.each<[UserRole | 'anonymous', number]>([
    ['anonymous', 401],
    ['reporter', 403],
    ['editor', 403],
    ['admin', 200],
  ])('%s → %i', async (role, status) => {
    const actor = role === 'anonymous' ? null : await signIn(app, role);
    expect((await call(actor, 'POST', `/v1/admin/promises/${promiseId}/status`, change())).statusCode).toBe(status);
    expect((await call(actor, 'GET', `/v1/admin/promises/${promiseId}/updates`)).statusCode).toBe(status);
  });

  it('404s for an unknown promise', async () => {
    expect((await call(dataEditor, 'POST', '/v1/admin/promises/999999/status', change())).statusCode).toBe(404);
    expect((await call(dataEditor, 'GET', '/v1/admin/promises/999999/updates')).statusCode).toBe(404);
  });
});

describe('status outside the status endpoint', () => {
  it('is refused on create and update', async () => {
    const create = await call(dataEditor, 'POST', '/v1/admin/promises', {
      personId: refs.personA.id,
      textMn: 'Шинэ амлалт',
      madeOn: '2024-06-10',
      sourceUrl: SRC,
      status: 'kept',
    });
    const update = await call(dataEditor, 'PATCH', `/v1/admin/promises/${promiseId}`, { textMn: 'Засвар', status: 'kept' });

    expect(create.statusCode).toBe(400);
    expect(errorCode(create)).toBe('VALIDATION_ERROR');
    expect(update.statusCode).toBe(400);
    expect(errorCode(update)).toBe('VALIDATION_ERROR');
  });

  it('new promises start as not_rated', async () => {
    const res = await call(dataEditor, 'POST', '/v1/admin/promises', { personId: refs.personA.id, textMn: 'Шинэ амлалт', madeOn: '2024-06-10', sourceUrl: SRC });

    expect(adminPromiseResponseSchema.parse(res.json()).data.status).toBe('not_rated');
  });
});
