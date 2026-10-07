import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { App } from '../app';
import { organizations, promises } from '../db/schema/index';
import { buildTestApp } from '../test/app';
import type { FakeJobs } from '../test/fake-jobs';
import { seedRefs, SRC, type Refs } from '../test/political';
import { resetDb } from '../test/reset-db';
import { signIn, type TestActor } from '../test/sessions';

let app: App;
let refs: Refs;
let admin: TestActor;

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
  admin = await signIn(app, 'admin');
  jobs().reset();
});

const jobs = () => app.jobs as FakeJobs;
const revalidated = () => jobs().calls.flatMap((call) => (call.type === 'enqueueRevalidate' ? [call.tags] : []));

async function call(method: 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) {
  const res = await app.inject({ method, url, payload: payload as object | undefined, cookies: admin.cookies, headers: admin.headers });
  expect(res.statusCode, res.body).toBeLessThan(300);
  return res.statusCode === 204 ? null : (res.json() as { data: Record<string, unknown> }).data;
}

describe('web revalidation after admin edits', () => {
  it('persons and their positions revalidate that person', async () => {
    const created = await call('POST', '/v1/admin/persons', { givenNameMn: 'Тэмүүлэн', patronymicMn: 'Цэрэн' });
    const id = created!.id as number;
    await call('PATCH', `/v1/admin/persons/${id}`, { bioMn: 'Намтар' });
    const position = await call('POST', '/v1/admin/positions', {
      personId: refs.personA.id,
      organizationId: refs.party.id,
      titleMn: 'Гишүүн',
      startDate: '2020-01-01',
      sourceUrl: SRC,
    });
    await call('DELETE', `/v1/admin/positions/${position!.id as number}`);
    await call('DELETE', `/v1/admin/persons/${id}`);

    expect(revalidated()).toEqual([[`person:${id}`], [`person:${id}`], [`person:${refs.personA.id}`], [`person:${refs.personA.id}`], [`person:${id}`]]);
  });

  it('records revalidate their person; a party promise revalidates every profile', async () => {
    const statement = await call('POST', '/v1/admin/statements', { personId: refs.personB.id, quoteMn: 'Ишлэл', saidOn: '2025-01-01', sourceUrl: SRC });
    await call('DELETE', `/v1/admin/statements/${statement!.id as number}`);
    const promise = await call('POST', '/v1/admin/promises', { personId: refs.personA.id, textMn: 'Амлалт', madeOn: '2024-06-10', sourceUrl: SRC });
    await call('POST', `/v1/admin/promises/${promise!.id as number}/status`, { status: 'kept', date: '2025-01-01', noteMn: 'Биелсэн.', sourceUrl: SRC });
    const [partyPromise] = await app.db.insert(promises).values({ organizationId: refs.party.id, textMn: 'Намын амлалт', madeOn: '2024-06-10', sourceUrl: SRC }).returning();
    await call('PATCH', `/v1/admin/promises/${partyPromise!.id}`, { textMn: 'Засвар' });
    await call('POST', '/v1/admin/declarations', { personId: refs.personA.id, year: 2024, sourceUrl: SRC });

    expect(revalidated()).toEqual([
      [`person:${refs.personB.id}`],
      [`person:${refs.personB.id}`],
      [`person:${refs.personA.id}`],
      [`person:${refs.personA.id}`],
      ['people'],
      [`person:${refs.personA.id}`],
    ]);
  });

  it('organization edits and committed position imports revalidate all profiles; dry runs do not', async () => {
    await call('PATCH', `/v1/admin/organizations/${refs.party.id}`, { color: '#112233' });
    const row = { personId: refs.personA.id, organizationId: refs.party.id, titleMn: 'Гишүүн', startDate: '2021-01-01', sourceUrl: SRC };
    await call('POST', '/v1/admin/positions/import', { dryRun: true, rows: [row] });
    await call('POST', '/v1/admin/positions/import', { rows: [row] });

    expect(revalidated()).toEqual([['people'], ['people']]);
  });

  it('bill, stage and vote changes revalidate the parliament block', async () => {
    await call('PATCH', `/v1/admin/bills/${refs.bill.id}`, { status: 'in_committee' });
    await call('POST', '/v1/admin/bill-stages', { billId: refs.bill.id, stage: 'consideration', date: '2025-01-10', sourceUrl: SRC });
    await call('POST', '/v1/admin/votes/import', {
      rows: [{ billId: refs.bill.id, personId: refs.personA.id, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: SRC }],
    });

    expect(revalidated()).toEqual([['parliament'], ['parliament'], ['parliament']]);
  });

  it('corrections revalidate the page of what they correct', async () => {
    await call('POST', '/v1/admin/corrections', { entityType: 'article', entityId: refs.article.id, date: '2025-01-01', description: 'Засав.', reason: 'Алдаа' });
    await call('POST', '/v1/admin/corrections', { entityType: 'person', entityId: refs.personA.id, date: '2025-01-01', description: 'Засав.', reason: 'Алдаа' });
    await call('POST', '/v1/admin/corrections', { entityType: 'vote', entityId: 1, date: '2025-01-01', description: 'Засав.', reason: 'Алдаа' });

    expect(revalidated()).toEqual([[`article:${refs.article.id}`], [`person:${refs.personA.id}`], ['parliament']]);
  });

  it('a failing queue does not fail the saved change', async () => {
    const spy = vi.spyOn(app.jobs, 'enqueueRevalidate').mockRejectedValueOnce(new Error('redis down'));
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/organizations/${refs.party.id}`,
      payload: { color: '#445566' },
      cookies: admin.cookies,
      headers: admin.headers,
    });

    expect(res.statusCode).toBe(200);
    const [row] = await app.db.select().from(organizations);
    expect(row?.color).toBe('#445566');
    spy.mockRestore();
  });
});
