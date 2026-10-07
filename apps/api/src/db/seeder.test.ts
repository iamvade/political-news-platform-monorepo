import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resetDb } from '../test/reset-db';
import { assertTestDatabase } from '../test/test-env';
import { createDb } from './client';
import { articles, organizations, persons, promises, votes } from './schema/index';
import { seed, SeedRefusedError } from './seeder';

/** Postgres error code from a failed Drizzle query (wrapped in `cause`). */
async function pgErrorCode(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise;
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause;
    return cause?.code ?? (err as { code?: string }).code;
  }
  return undefined;
}

describe('seed + schema constraints', () => {
  const url = process.env.DATABASE_URL!;
  assertTestDatabase(url);
  const { db, sql } = createDb(url, { max: 1 });

  beforeAll(async () => {
    await resetDb(db);
    await seed(db);
  });

  afterAll(async () => {
    await resetDb(db);
    await sql.end({ timeout: 5 });
  });

  it('inserts the expected sample data', async () => {
    const [parties] = await db.select({ n: count() }).from(organizations).where(eq(organizations.type, 'party'));
    const [people] = await db.select({ n: count() }).from(persons);
    const [news] = await db.select({ n: count() }).from(articles);
    const [published] = await db.select({ n: count() }).from(articles).where(eq(articles.status, 'published'));

    expect(parties?.n).toBe(5);
    expect(people?.n).toBe(20);
    expect(news?.n).toBe(10);
    expect(published?.n).toBe(7);
  });

  it('refuses to seed a database that already has data', async () => {
    await expect(seed(db)).rejects.toBeInstanceOf(SeedRefusedError);
  });

  it('rejects a duplicate vote for the same bill, person, date and motion', async () => {
    const [vote] = await db.select().from(votes).limit(1);
    if (!vote) throw new Error('no seeded vote');
    const { id: _id, createdAt: _c, updatedAt: _u, ...duplicate } = vote;

    expect(await pgErrorCode(db.insert(votes).values(duplicate))).toBe('23505'); // unique_violation
    // A different motion on the same day is allowed.
    await db.insert(votes).values({ ...duplicate, motion: 'amendment_1' });
  });

  it('requires an http(s) source_url on factual tables', async () => {
    const [vote] = await db.select().from(votes).limit(1);
    if (!vote) throw new Error('no seeded vote');
    const { id: _id, createdAt: _c, updatedAt: _u, ...values } = vote;

    const code = await pgErrorCode(db.insert(votes).values({ ...values, motion: 'bad_source', sourceUrl: 'not a url' }));
    expect(code).toBe('23514'); // check_violation
  });

  it('requires exactly one subject on a promise', async () => {
    const [person] = await db.select({ id: persons.id }).from(persons).limit(1);
    const [org] = await db.select({ id: organizations.id }).from(organizations).limit(1);

    const base = { textMn: 'Туршилт', madeOn: '2025-01-01', sourceUrl: 'https://source.example/test' };
    expect(await pgErrorCode(db.insert(promises).values(base))).toBe('23514');
    expect(
      await pgErrorCode(db.insert(promises).values({ ...base, personId: person!.id, organizationId: org!.id })),
    ).toBe('23514');
  });

  it('requires published_at on published articles', async () => {
    const [article] = await db.select().from(articles).where(eq(articles.status, 'draft')).limit(1);
    if (!article) throw new Error('no draft article');

    const code = await pgErrorCode(db.update(articles).set({ status: 'published' }).where(eq(articles.id, article.id)));
    expect(code).toBe('23514');
  });
});
