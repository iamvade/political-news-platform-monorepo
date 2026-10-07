import { errorResponseSchema, importResultResponseSchema, type ImportResult } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../app';
import { auditLog, positions, votes } from '../db/schema/index';
import { buildTestApp } from '../test/app';
import { seedRefs, SRC, type Refs } from '../test/political';
import { resetDb } from '../test/reset-db';
import { signIn, type TestActor } from '../test/sessions';

let app: App;
let refs: Refs;
let dataEditor: TestActor;

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
});

async function post(url: string, payload: unknown, actor = dataEditor) {
  return app.inject({ method: 'POST', url, payload: payload as object, cookies: actor.cookies, headers: actor.headers });
}

async function ok(url: string, payload: unknown): Promise<ImportResult> {
  const res = await post(url, payload);
  expect(res.statusCode, res.body).toBe(200);
  return importResultResponseSchema.parse(res.json()).data;
}

const countRows = async () => ({
  votes: (await app.db.select().from(votes)).length,
  positions: (await app.db.select().from(positions)).length,
  audit: (await app.db.select().from(auditLog)).length,
});

const VOTES = '/v1/admin/votes/import';
const POSITIONS = '/v1/admin/positions/import';

const voteRow = (overrides: Record<string, unknown> = {}) => ({
  billSlug: 'tax-bill',
  personSlug: 'g-batbayar',
  value: 'yes',
  date: '2025-04-17',
  motion: 'final_vote',
  sourceUrl: SRC,
  ...overrides,
});

describe('votes import', () => {
  it('dry run returns the diff and writes nothing (not even the audit row)', async () => {
    const result = await ok(VOTES, { dryRun: true, rows: [voteRow(), voteRow({ personSlug: 'd-sarantuya', value: 'no' })] });

    expect(result).toMatchObject({ dryRun: true, summary: { create: 2, update: 0, unchanged: 0 } });
    expect(result.diff.create[0]).toMatchObject({ billId: refs.bill.id, personId: refs.personA.id, value: 'yes' });
    expect(await countRows()).toEqual({ votes: 0, positions: 0, audit: 0 });
  });

  it('commit applies everything in one transaction with one audit row; re-import is all unchanged', async () => {
    const rows = [voteRow(), voteRow({ personSlug: 'd-sarantuya', value: 'no' })];

    const first = await ok(VOTES, { rows });
    const second = await ok(VOTES, { rows });

    expect(first.summary).toEqual({ create: 2, update: 0, unchanged: 0 });
    expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 2 });
    expect((await countRows()).votes).toBe(2);
    const [audit] = await app.db.select().from(auditLog).where(eq(auditLog.action, 'import'));
    expect(audit).toMatchObject({ entityType: 'vote', entityId: null, actorId: dataEditor.user.id });
    expect(audit?.diff).toMatchObject({ summary: { create: 2, update: 0, unchanged: 0 } });
  });

  it('reports changed values as before/after and only updates those rows', async () => {
    await ok(VOTES, { rows: [voteRow(), voteRow({ personSlug: 'd-sarantuya' })] });

    const result = await ok(VOTES, {
      rows: [voteRow({ value: 'absent' }), voteRow({ personSlug: 'd-sarantuya' }), voteRow({ motion: 'consideration' })],
    });

    expect(result.summary).toEqual({ create: 1, update: 1, unchanged: 1 });
    expect(result.diff.update).toEqual([
      {
        key: expect.objectContaining({ billId: refs.bill.id, personId: refs.personA.id, motion: 'final_vote' }),
        before: { value: 'yes' },
        after: { value: 'absent' },
      },
    ]);
  });

  it('accepts ids instead of slugs', async () => {
    const result = await ok(VOTES, { rows: [voteRow({ billSlug: undefined, billId: refs.bill.id, personSlug: undefined, personId: refs.personB.id })] });

    expect(result.summary.create).toBe(1);
  });

  it.each([
    ['unknown person slug', [voteRow({ personSlug: 'no-such-person' })], 'rows.0.personSlug'],
    ['unknown bill id', [voteRow({ billSlug: undefined, billId: 999_999 })], 'rows.0.billId'],
    ['duplicate key in payload', [voteRow(), voteRow({ value: 'no' })], 'rows.1.motion'],
  ])('rejects %s with IMPORT_INVALID and writes nothing, even without dryRun', async (_label, rows, path) => {
    const res = await post(VOTES, { rows });

    expect(res.statusCode).toBe(400);
    const error = errorResponseSchema.parse(res.json()).error;
    expect(error.code).toBe('IMPORT_INVALID');
    expect(error.details?.map((d) => d.path)).toContain(path);
    expect(await countRows()).toEqual({ votes: 0, positions: 0, audit: 0 });
  });

  it('a soft-deleted person counts as unknown', async () => {
    const admin = await signIn(app, 'admin');
    await app.inject({ method: 'DELETE', url: `/v1/admin/persons/${refs.personA.id}`, cookies: admin.cookies, headers: admin.headers });

    const res = await post(VOTES, { rows: [voteRow()] });

    expect(errorResponseSchema.parse(res.json()).error.code).toBe('IMPORT_INVALID');
  });

  it.each([
    ['both id and slug', voteRow({ personId: 1 })], // fails validation before any lookup
    ['neither id nor slug', voteRow({ personSlug: undefined })],
    ['bad value', voteRow({ value: 'maybe' })],
    ['bad source url', voteRow({ sourceUrl: 'not a url' })],
  ])('rejects an invalid row (%s) at validation', async (_label, row) => {
    const res = await post(VOTES, { rows: [row] });

    expect(res.statusCode).toBe(400);
    expect(errorResponseSchema.parse(res.json()).error.details?.[0]?.path).toMatch(/^body\.rows\.0/);
  });

  it('caps the payload at 5,000 rows', async () => {
    const rows = Array.from({ length: 5_001 }, (_, i) => voteRow({ motion: `m${i}` }));

    const res = await post(VOTES, { dryRun: true, rows });

    expect(res.statusCode).toBe(400);
  });

  it('is forbidden for editors', async () => {
    const editor = await signIn(app, 'editor');

    const res = await post(VOTES, { rows: [voteRow()] }, editor);

    expect(res.statusCode).toBe(403);
  });
});

describe('positions import', () => {
  const positionRow = (overrides: Record<string, unknown> = {}) => ({
    personSlug: 'g-batbayar',
    organizationSlug: 'mpp',
    titleMn: 'Гишүүн',
    startDate: '2010-03-01',
    sourceUrl: SRC,
    ...overrides,
  });

  it('creates, then updates endDate in place; omitted fields are left unchanged', async () => {
    await ok(POSITIONS, { rows: [positionRow({ titleEn: 'Member' })] });

    const result = await ok(POSITIONS, { rows: [positionRow({ endDate: '2024-01-31' })] });

    expect(result.summary).toEqual({ create: 0, update: 1, unchanged: 0 });
    expect(result.diff.update[0]).toMatchObject({ before: { endDate: null }, after: { endDate: '2024-01-31' } });
    const [row] = await app.db.select().from(positions);
    expect(row).toMatchObject({ titleEn: 'Member', endDate: '2024-01-31' });
  });

  it('explicit null clears a field', async () => {
    await ok(POSITIONS, { rows: [positionRow({ endDate: '2024-01-31' })] });

    const result = await ok(POSITIONS, { rows: [positionRow({ endDate: null })] });

    expect(result.diff.update[0]).toMatchObject({ before: { endDate: '2024-01-31' }, after: { endDate: null } });
  });

  it('dry run leaves the table untouched', async () => {
    const result = await ok(POSITIONS, { dryRun: true, rows: [positionRow(), positionRow({ personSlug: 'd-sarantuya' })] });

    expect(result.summary.create).toBe(2);
    expect(await countRows()).toEqual({ votes: 0, positions: 0, audit: 0 });
  });

  it('rejects an unknown organization and end-before-start', async () => {
    const unknown = await post(POSITIONS, { rows: [positionRow({ organizationSlug: 'no-such-org' })] });
    const backwards = await post(POSITIONS, { rows: [positionRow({ endDate: '2000-01-01' })] });

    expect(errorResponseSchema.parse(unknown.json()).error).toMatchObject({ code: 'IMPORT_INVALID' });
    expect(backwards.statusCode).toBe(400);
    expect(await countRows()).toEqual({ votes: 0, positions: 0, audit: 0 });
  });
});
