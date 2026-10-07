import { errorResponseSchema, type UserRole } from '@news/shared/schemas';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../app';
import { auditLog, billSponsors, persons } from '../db/schema/index';
import { buildTestApp } from '../test/app';
import { RESOURCES, seedRefs, SRC, type Refs, type ResourceSpec } from '../test/political';
import { resetDb } from '../test/reset-db';
import { signIn, type TestActor } from '../test/sessions';

let app: App;
let refs: Refs;
let actors: Record<UserRole, TestActor>;

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
  actors = {
    reporter: await signIn(app, 'reporter'),
    editor: await signIn(app, 'editor'),
    data_editor: await signIn(app, 'data_editor'),
    admin: await signIn(app, 'admin'),
  };
});

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

function call(actor: TestActor, method: Method, url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as object | undefined, cookies: actor.cookies, headers: actor.headers });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;

async function createAsAdmin(spec: ResourceSpec): Promise<number> {
  const res = await call(actors.admin, 'POST', spec.path, spec.create(refs));
  expect(res.statusCode, res.body).toBe(201);
  return (res.json() as { data: { id: number } }).data.id;
}

describe('role rules (every resource)', () => {
  const EXPECT: Record<UserRole, (spec: ResourceSpec) => Record<'list' | 'get' | 'create' | 'update' | 'delete', number>> = {
    reporter: () => ({ list: 403, get: 403, create: 403, update: 403, delete: 403 }),
    editor: () => ({ list: 403, get: 403, create: 403, update: 403, delete: 403 }),
    data_editor: (spec) => ({ list: 200, get: 200, create: 201, update: 200, delete: spec.softDelete ? 204 : 403 }),
    admin: () => ({ list: 200, get: 200, create: 201, update: 200, delete: 204 }),
  };

  const cases = RESOURCES.flatMap((spec) => (Object.keys(EXPECT) as UserRole[]).map((role) => [spec.name, role, spec] as const));

  it.each(cases)('%s as %s', async (_name, role, spec) => {
    const id = await createAsAdmin(spec);
    const actor = actors[role];

    const statuses = {
      list: (await call(actor, 'GET', spec.path)).statusCode,
      get: (await call(actor, 'GET', `${spec.path}/${id}`)).statusCode,
      // A second row, so unique keys (votes, declarations) don't collide with the admin-created one.
      create: (await call(actor, 'POST', spec.path, uniqueVariant(spec, refs))).statusCode,
      update: (await call(actor, 'PATCH', `${spec.path}/${id}`, spec.update)).statusCode,
      delete: (await call(actor, 'DELETE', `${spec.path}/${id}`)).statusCode,
    };

    expect(statuses).toEqual(EXPECT[role](spec));
  });
});

/** A second row that doesn't collide with unique keys of the first. */
function uniqueVariant(spec: ResourceSpec, r: Refs): Record<string, unknown> {
  const body = spec.create(r);
  switch (spec.name) {
    case 'votes':
      return { ...body, motion: 'consideration' };
    case 'declarations':
      return { ...body, year: 2023 };
    default:
      return body;
  }
}

describe('CRUD lifecycle with audit log (every resource)', () => {
  it.each(RESOURCES.map((spec) => [spec.name, spec] as const))('%s', async (_name, spec) => {
    const actor = actors.data_editor;

    const created = await call(actor, 'POST', spec.path, spec.create(refs));
    expect(created.statusCode, created.body).toBe(201);
    const id = (created.json() as { data: { id: number } }).data.id;

    const fetched = await call(actor, 'GET', `${spec.path}/${id}`);
    expect(fetched.statusCode).toBe(200);
    expect((fetched.json() as { data: Record<string, unknown> }).data).toMatchObject({ id, ...stripUndefined(spec.create(refs)) });

    const updated = await call(actor, 'PATCH', `${spec.path}/${id}`, spec.update);
    expect(updated.statusCode, updated.body).toBe(200);
    expect((updated.json() as { data: Record<string, unknown> }).data).toMatchObject(spec.update);

    const listed = await call(actor, 'GET', `${spec.path}?${spec.filter(refs)}`);
    const list = listed.json() as { data: { id: number }[]; pagination: { total: number } };
    expect(list.data.map((row) => row.id)).toContain(id);

    const deleter = spec.softDelete ? actor : actors.admin;
    expect((await call(deleter, 'DELETE', `${spec.path}/${id}`)).statusCode).toBe(204);
    expect((await call(actor, 'GET', `${spec.path}/${id}`)).statusCode).toBe(404);

    const trail = await app.db
      .select({ action: auditLog.action, actorId: auditLog.actorId, diff: auditLog.diff })
      .from(auditLog)
      .where(and(eq(auditLog.entityType, spec.entityType), eq(auditLog.entityId, id)))
      .orderBy(asc(auditLog.id));
    expect(trail.map((t) => t.action)).toEqual(['create', 'update', spec.softDelete ? 'soft_delete' : 'delete']);
    expect(trail[0]?.actorId).toBe(actor.user.id);
    const changedField = Object.keys(spec.update)[0]!;
    expect(trail[1]?.diff).toHaveProperty(changedField);
  });
});

function stripUndefined(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined));
}

describe('slugs, soft delete, sponsors', () => {
  it('generates person slugs from the name, with a suffix on collision', async () => {
    const first = await call(actors.data_editor, 'POST', '/v1/admin/persons', { givenNameMn: 'Номин', patronymicMn: 'Лхагва' });
    const second = await call(actors.data_editor, 'POST', '/v1/admin/persons', { givenNameMn: 'Номин', patronymicMn: 'Лувсан' });

    expect((first.json() as { data: { slug: string; displayName: string } }).data).toMatchObject({ slug: 'l-nomin', displayName: 'Л.Номин' });
    expect((second.json() as { data: { slug: string } }).data.slug).toBe('l-nomin-2');
  });

  it('rejects an explicit slug that is taken', async () => {
    const res = await call(actors.data_editor, 'POST', '/v1/admin/persons', { slug: 'g-batbayar', givenNameMn: 'X', patronymicMn: 'Y' });

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('DUPLICATE');
  });

  it('hides soft-deleted persons; only admins may list them', async () => {
    await call(actors.data_editor, 'DELETE', `/v1/admin/persons/${refs.personB.id}`);

    const visible = (await call(actors.data_editor, 'GET', '/v1/admin/persons')).json() as { data: { id: number }[] };
    const forbidden = await call(actors.data_editor, 'GET', '/v1/admin/persons?includeDeleted=true');
    const all = (await call(actors.admin, 'GET', '/v1/admin/persons?includeDeleted=true')).json() as { data: { id: number; deletedAt: string | null }[] };

    expect(visible.data.map((p) => p.id)).not.toContain(refs.personB.id);
    expect(forbidden.statusCode).toBe(403);
    expect(all.data.find((p) => p.id === refs.personB.id)?.deletedAt).not.toBeNull();
    const [row] = await app.db.select().from(persons).where(eq(persons.id, refs.personB.id));
    expect(row?.deletedAt).toBeInstanceOf(Date);
  });

  it('PUT /bills/:id/sponsors replaces the list', async () => {
    const url = `/v1/admin/bills/${refs.bill.id}/sponsors`;
    await call(actors.data_editor, 'PUT', url, {
      sponsors: [
        { personId: refs.personA.id, role: 'initiator' },
        { personId: refs.personB.id, role: 'co_sponsor' },
      ],
    });

    const res = await call(actors.data_editor, 'PUT', url, { sponsors: [{ personId: refs.personB.id, role: 'initiator' }] });

    expect((res.json() as { data: { sponsors: unknown[] } }).data.sponsors).toEqual([{ personId: refs.personB.id, role: 'initiator' }]);
    expect(await app.db.select().from(billSponsors)).toHaveLength(1);
  });

  it('rejects a person listed twice as sponsor', async () => {
    const res = await call(actors.data_editor, 'PUT', `/v1/admin/bills/${refs.bill.id}/sponsors`, {
      sponsors: [
        { personId: refs.personA.id, role: 'initiator' },
        { personId: refs.personA.id, role: 'co_sponsor' },
      ],
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('constraints map to clear API errors', () => {
  it('promise needs exactly one subject', async () => {
    const base = { textMn: 'x', madeOn: '2024-01-01', sourceUrl: SRC };
    const none = await call(actors.data_editor, 'POST', '/v1/admin/promises', base);
    const both = await call(actors.data_editor, 'POST', '/v1/admin/promises', { ...base, personId: refs.personA.id, organizationId: refs.party.id });

    expect(none.statusCode).toBe(400);
    expect(both.statusCode).toBe(400);
  });

  it('PATCH cannot give a promise a second subject (DB CHECK backstop)', async () => {
    const created = await call(actors.data_editor, 'POST', '/v1/admin/promises', {
      personId: refs.personA.id,
      textMn: 'x',
      madeOn: '2024-01-01',
      sourceUrl: SRC,
    });
    const id = (created.json() as { data: { id: number } }).data.id;

    const res = await call(actors.data_editor, 'PATCH', `/v1/admin/promises/${id}`, { organizationId: refs.party.id });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('duplicate declaration (person, year) → 409 DUPLICATE', async () => {
    const body = { personId: refs.personA.id, year: 2024, sourceUrl: SRC };
    await call(actors.data_editor, 'POST', '/v1/admin/declarations', body);

    const res = await call(actors.data_editor, 'POST', '/v1/admin/declarations', body);

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('DUPLICATE');
  });

  it('position end before start → 400', async () => {
    const res = await call(actors.data_editor, 'POST', '/v1/admin/positions', {
      personId: refs.personA.id,
      organizationId: refs.party.id,
      titleMn: 'Гишүүн',
      startDate: '2025-01-01',
      endDate: '2024-01-01',
      sourceUrl: SRC,
    });

    expect(res.statusCode).toBe(400);
  });

  it('unknown referenced id → 400 REFERENCE_NOT_FOUND', async () => {
    const res = await call(actors.data_editor, 'POST', '/v1/admin/statements', {
      personId: 999_999,
      quoteMn: 'x',
      saidOn: '2025-01-01',
      sourceUrl: SRC,
    });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('REFERENCE_NOT_FOUND');
  });

  it('deleting a bill that still has votes → 409 IN_USE', async () => {
    await call(actors.data_editor, 'POST', '/v1/admin/votes', {
      billId: refs.bill.id,
      personId: refs.personA.id,
      value: 'yes',
      date: '2025-04-17',
      motion: 'final_vote',
      sourceUrl: SRC,
    });

    const res = await call(actors.admin, 'DELETE', `/v1/admin/bills/${refs.bill.id}`);

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('IN_USE');
  });

  it.each(['ftp://source.example/x', 'javascript:alert(1)', 'not a url'])('rejects source_url %s', async (sourceUrl) => {
    const res = await call(actors.data_editor, 'POST', '/v1/admin/statements', {
      personId: refs.personA.id,
      quoteMn: 'x',
      saidOn: '2025-01-01',
      sourceUrl,
    });

    expect(res.statusCode).toBe(400);
  });

  it('declaration amounts must be decimal strings', async () => {
    const res = await call(actors.data_editor, 'POST', '/v1/admin/declarations', {
      personId: refs.personA.id,
      year: 2022,
      income: 48000000.5,
      sourceUrl: SRC,
    });

    expect(res.statusCode).toBe(400);
  });

  it('empty PATCH → 400', async () => {
    const res = await call(actors.data_editor, 'PATCH', `/v1/admin/persons/${refs.personA.id}`, {});

    expect(res.statusCode).toBe(400);
  });
});
