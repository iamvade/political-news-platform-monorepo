import { publicParliamentWeekResponseSchema } from '@news/shared/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { eq } from 'drizzle-orm';
import { billStages, bills, persons, votes } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { seedRefs, SRC, type Refs } from '../../test/political';
import { resetDb } from '../../test/reset-db';
import { parliamentWeekWindow } from './public.service';

let app: App;
let refs: Refs;

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
});

const day = (offset: number) => {
  const { to } = parliamentWeekWindow(new Date());
  const d = new Date(`${to}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

describe('parliamentWeekWindow', () => {
  it('is the last 7 Ulaanbaatar calendar days', () => {
    // 2026-10-07 23:30 UTC is already the 8th in Ulaanbaatar (UTC+8).
    expect(parliamentWeekWindow(new Date('2026-10-07T23:30:00Z'))).toEqual({ from: '2026-10-02', to: '2026-10-08' });
  });
});

describe('GET /v1/public/parliament/week', () => {
  it('lists stage changes and tallied roll calls from the last 7 days, newest first', async () => {
    const [other] = await app.db
      .insert(bills)
      .values({ slug: 'budget-bill', titleMn: 'Төсвийн тухай хуулийн төсөл', initiatorType: 'government', status: 'in_plenary', sourceUrl: SRC })
      .returning();
    await app.db.insert(billStages).values([
      { billId: refs.bill.id, stage: 'submitted', date: day(-7), sourceUrl: SRC }, // outside the window
      { billId: refs.bill.id, stage: 'first_reading', date: day(-6), sourceUrl: SRC },
      { billId: other!.id, stage: 'final_reading', date: day(0), noteMn: 'Эцсийн хэлэлцүүлэг', sourceUrl: SRC },
    ]);
    await app.db.insert(votes).values([
      { billId: refs.bill.id, personId: refs.personA.id, value: 'yes', date: day(-1), motion: 'final_vote', sourceUrl: SRC },
      { billId: refs.bill.id, personId: refs.personB.id, value: 'no', date: day(-1), motion: 'final_vote', sourceUrl: SRC },
      { billId: refs.bill.id, personId: refs.personA.id, value: 'absent', date: day(-8), motion: 'consideration', sourceUrl: SRC },
    ]);

    const res = await app.inject({ method: 'GET', url: '/v1/public/parliament/week' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400');
    const week = publicParliamentWeekResponseSchema.parse(res.json()).data;
    expect(week).toMatchObject({ from: day(-6), to: day(0) });
    expect(week.stages.map((s) => [s.bill.slug, s.stage, s.date])).toEqual([
      ['budget-bill', 'final_reading', day(0)],
      ['tax-bill', 'first_reading', day(-6)],
    ]);
    expect(week.votes).toEqual([
      { bill: { slug: 'tax-bill', titleMn: 'Татварын хуулийн төсөл' }, date: day(-1), motion: 'final_vote', tally: { yes: 1, no: 1, abstain: 0, absent: 0 }, sourceUrl: SRC },
    ]);
  });

  it('does not count votes of soft-deleted persons (same as the bill page)', async () => {
    await app.db.insert(votes).values([
      { billId: refs.bill.id, personId: refs.personA.id, value: 'yes', date: day(0), motion: 'final_vote', sourceUrl: SRC },
      { billId: refs.bill.id, personId: refs.personB.id, value: 'no', date: day(0), motion: 'final_vote', sourceUrl: SRC },
    ]);
    await app.db.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, refs.personB.id));

    const week = publicParliamentWeekResponseSchema.parse((await app.inject({ method: 'GET', url: '/v1/public/parliament/week' })).json()).data;

    expect(week.votes.map((v) => v.tally)).toEqual([{ yes: 1, no: 0, abstain: 0, absent: 0 }]);
  });

  it('returns empty lists in a quiet week', async () => {
    const week = publicParliamentWeekResponseSchema.parse((await app.inject({ method: 'GET', url: '/v1/public/parliament/week' })).json()).data;
    expect(week.stages).toEqual([]);
    expect(week.votes).toEqual([]);
  });
});

describe('public person references', () => {
  it('carry the person id (web URLs are /person/{id}-{slug})', async () => {
    await app.db.insert(votes).values({ billId: refs.bill.id, personId: refs.personA.id, value: 'yes', date: '2025-01-15', motion: 'final_vote', sourceUrl: SRC });

    const res = await app.inject({ method: 'GET', url: '/v1/public/bills/tax-bill' });

    expect(res.json().data.votes[0].votes[0].person).toMatchObject({ id: refs.personA.id, slug: refs.personA.slug });
  });
});
