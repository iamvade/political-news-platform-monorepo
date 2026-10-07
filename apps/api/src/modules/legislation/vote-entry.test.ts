import { errorResponseSchema, voteRosterResponseSchema, voteSessionListResponseSchema } from '@news/shared/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { organizations, persons, positions, votes } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { seedRefs, SRC, type Refs } from '../../test/political';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let refs: Refs;
let dataEditor: TestActor;
let people: Record<'listMp' | 'committeeOnly' | 'formerMp' | 'deletedMp', number>;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

async function person(slug: string, givenNameMn: string, patronymicMn: string, deleted = false) {
  const [row] = await app.db
    .insert(persons)
    .values({ slug, givenNameMn, patronymicMn, deletedAt: deleted ? new Date() : null })
    .returning();
  return row!.id;
}

beforeEach(async () => {
  await resetDb(app.db);
  refs = await seedRefs(app);
  dataEditor = await signIn(app, 'data_editor');

  const [parliament] = await app.db.insert(organizations).values({ type: 'parliament', slug: 'ikh-khural', nameMn: 'Улсын Их Хурал' }).returning();
  const [district] = await app.db
    .insert(organizations)
    .values({ type: 'constituency', slug: 'district-1', nameMn: '1-р тойрог', parentId: parliament!.id })
    .returning();
  const [committee] = await app.db
    .insert(organizations)
    .values({ type: 'committee', slug: 'budget', nameMn: 'Төсвийн байнгын хороо', parentId: parliament!.id })
    .returning();

  people = {
    listMp: await person('a-ankhaa', 'Анхаа', 'Алтай'),
    committeeOnly: await person('b-bold', 'Болд', 'Бат'),
    formerMp: await person('ts-tsetseg', 'Цэцэг', 'Цэрэн'),
    deletedMp: await person('d-dorj', 'Дорж', 'Дамба', true),
  };
  const seat = { titleMn: 'УИХ-ын гишүүн', sourceUrl: SRC };
  await app.db.insert(positions).values([
    // Г.Батбаяр: district MP since 2024-07-01, МАН member.
    { ...seat, personId: refs.personA.id, organizationId: district!.id, startDate: '2024-07-01' },
    { personId: refs.personA.id, organizationId: refs.party.id, titleMn: 'Гишүүн', startDate: '2010-01-01', sourceUrl: SRC },
    // А.Анхаа: party-list MP (seat on the parliament itself).
    { ...seat, personId: people.listMp, organizationId: parliament!.id, startDate: '2024-07-01' },
    // Б.Болд: a committee seat is not an MP seat.
    { personId: people.committeeOnly, organizationId: committee!.id, titleMn: 'Гишүүн', startDate: '2024-07-01', sourceUrl: SRC },
    // Ц.Цэцэг: MP until 2024-06-30.
    { ...seat, personId: people.formerMp, organizationId: parliament!.id, startDate: '2020-07-01', endDate: '2024-06-30' },
    // Д.Дорж: soft-deleted.
    { ...seat, personId: people.deletedMp, organizationId: parliament!.id, startDate: '2024-07-01' },
  ]);
});

function get(actor: TestActor, url: string) {
  return app.inject({ method: 'GET', url, cookies: actor.cookies, headers: actor.headers });
}

const roster = async (date: string, motion = 'final_vote') => {
  const res = await get(dataEditor, `/v1/admin/bills/${refs.bill.id}/vote-roster?date=${date}&motion=${motion}`);
  expect(res.statusCode, res.body).toBe(200);
  return voteRosterResponseSchema.parse(res.json()).data;
};

describe('GET /v1/admin/bills/:id/vote-roster', () => {
  it('lists MPs serving on the date with their party, plus recorded voters out of office', async () => {
    await app.db.insert(votes).values([
      { billId: refs.bill.id, personId: refs.personA.id, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: SRC },
      { billId: refs.bill.id, personId: people.formerMp, value: 'no', date: '2025-01-15', motion: 'final_vote', sourceUrl: SRC },
      // Another motion on the same day does not leak in.
      { billId: refs.bill.id, personId: people.listMp, value: 'abstain', date: '2025-01-15', motion: 'consideration', sourceUrl: SRC },
    ]);

    const data = await roster('2025-01-15');

    expect(data.members.map((m) => [m.displayName, m.partyShortName, m.inOffice, m.value])).toEqual([
      ['А.Анхаа', null, true, null],
      ['Г.Батбаяр', 'МАН', true, 'yes'],
      ['Ц.Цэцэг', null, false, 'no'],
    ]);
    expect(data.members[1]).toMatchObject({ personId: refs.personA.id, sourceUrl: SRC, voteId: expect.any(Number) });
  });

  it('uses the seats held on the given date', async () => {
    const data = await roster('2024-06-01');

    expect(data.members.map((m) => m.displayName)).toEqual(['Ц.Цэцэг']);
  });

  it('validates the query and 404s for an unknown bill', async () => {
    const bad = await get(dataEditor, `/v1/admin/bills/${refs.bill.id}/vote-roster?date=2025-13-01&motion=final_vote`);
    const noMotion = await get(dataEditor, `/v1/admin/bills/${refs.bill.id}/vote-roster?date=2025-01-15`);
    const unknown = await get(dataEditor, '/v1/admin/bills/999999/vote-roster?date=2025-01-15&motion=final_vote');

    expect(bad.statusCode).toBe(400);
    expect(errorResponseSchema.parse(bad.json()).error.code).toBe('VALIDATION_ERROR');
    expect(noMotion.statusCode).toBe(400);
    expect(unknown.statusCode).toBe(404);
  });

  it('is limited to data editors and admins', async () => {
    const url = `/v1/admin/bills/${refs.bill.id}/vote-roster?date=2025-01-15&motion=final_vote`;
    expect((await get(await signIn(app, 'editor'), url)).statusCode).toBe(403);
    expect((await get(await signIn(app, 'reporter'), url)).statusCode).toBe(403);
    expect((await get(await signIn(app, 'admin'), url)).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(401);
  });
});

describe('GET /v1/admin/bills/:id/vote-sessions', () => {
  it('groups votes by (date, motion), newest first, with counts and sources', async () => {
    const vote = { billId: refs.bill.id, sourceUrl: SRC };
    await app.db.insert(votes).values([
      { ...vote, personId: refs.personA.id, value: 'yes', date: '2025-01-15', motion: 'final_vote' },
      { ...vote, personId: people.listMp, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: 'https://source.example/other' },
      { ...vote, personId: people.formerMp, value: 'no', date: '2025-01-15', motion: 'final_vote' },
      { ...vote, personId: refs.personA.id, value: 'absent', date: '2024-12-01', motion: 'consideration' },
    ]);

    const res = await get(dataEditor, `/v1/admin/bills/${refs.bill.id}/vote-sessions`);

    expect(res.statusCode).toBe(200);
    const body = voteSessionListResponseSchema.parse(res.json());
    expect(body.data).toEqual([
      { date: '2025-01-15', motion: 'final_vote', counts: { yes: 2, no: 1, abstain: 0, absent: 0 }, total: 3, sourceUrls: ['https://source.example/other', SRC] },
      { date: '2024-12-01', motion: 'consideration', counts: { yes: 0, no: 0, abstain: 0, absent: 1 }, total: 1, sourceUrls: [SRC] },
    ]);
    expect(body.pagination.total).toBe(2);
  });
});
