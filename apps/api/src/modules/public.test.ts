import {
  errorResponseSchema,
  publicArticleListResponseSchema,
  publicArticleResponseSchema,
  publicBillResponseSchema,
  publicOrganizationResponseSchema,
  publicPersonResponseSchema,
} from '@news/shared/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../app';
import {
  articlePersons,
  articleTags,
  billSponsors,
  billStages,
  categories,
  corrections,
  declarations,
  media,
  organizations,
  persons,
  positions,
  promises,
  statements,
  tags,
  votes,
} from '../db/schema/index';
import { buildTestApp } from '../test/app';
import { insertArticle } from '../test/articles';
import { seedRefs, SRC, type Refs } from '../test/political';
import { resetDb } from '../test/reset-db';

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

const get = (url: string) => app.inject({ method: 'GET', url: `/v1/public${url}` });
const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;

const NEWS = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400';
const PROFILE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400';

describe('articles', () => {
  it('lists only published articles, newest first, with category filter', async () => {
    const [politics] = await app.db.insert(categories).values({ slug: 'politics', nameMn: 'Улс төр' }).returning();
    const older = await insertArticle(app, refs.author.id, 'published', { publishedAt: new Date('2025-01-01'), categoryId: politics!.id });
    const newer = await insertArticle(app, refs.author.id, 'published', { publishedAt: new Date('2025-02-01') });
    await insertArticle(app, refs.author.id, 'draft');
    await insertArticle(app, refs.author.id, 'scheduled');
    await insertArticle(app, refs.author.id, 'published', { deletedAt: new Date() });

    const all = publicArticleListResponseSchema.parse((await get('/articles')).json());
    const filtered = publicArticleListResponseSchema.parse((await get('/articles?category=politics')).json());

    // seedRefs already inserted one published article (2026-01-01).
    expect(all.data.map((a) => a.id)).toEqual([refs.article.id, newer.id, older.id]);
    expect(filtered.data.map((a) => a.id)).toEqual([older.id]);
    expect(filtered.data[0]?.category).toEqual({ slug: 'politics', nameMn: 'Улс төр', nameEn: null });
  });

  it('filters by tag and exposes category/tag pages', async () => {
    const [tax] = await app.db.insert(tags).values({ slug: 'tax', nameMn: 'Татвар' }).returning();
    await app.db.insert(articleTags).values({ articleId: refs.article.id, tagId: tax!.id });
    await insertArticle(app, refs.author.id, 'published');

    const byTag = publicArticleListResponseSchema.parse((await get('/articles?tag=tax')).json());
    const tagPage = await get('/tags/tax');
    const tagArticles = publicArticleListResponseSchema.parse((await get('/tags/tax/articles')).json());

    expect(byTag.data.map((a) => a.id)).toEqual([refs.article.id]);
    expect(tagPage.json()).toEqual({ data: { slug: 'tax', nameMn: 'Татвар', nameEn: null } });
    expect(tagArticles.pagination.total).toBe(1);
    expect((await get('/categories/nope')).statusCode).toBe(404);
    expect((await get('/tags/nope/articles')).statusCode).toBe(404);
  });

  it('article detail: tags, persons, corrections; no internal fields', async () => {
    await app.db.insert(articlePersons).values({ articleId: refs.article.id, personId: refs.personA.id });
    await app.db.insert(corrections).values({
      entityType: 'article',
      entityId: refs.article.id,
      date: '2026-01-02',
      description: 'Тоог зассан',
      reason: 'Буруу тоо',
      createdBy: refs.author.id,
    });

    const res = await get(`/articles/${refs.article.slug}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe(NEWS);
    const article = publicArticleResponseSchema.parse(res.json()).data;
    expect(article.persons).toEqual([
      { id: refs.personA.id, slug: 'g-batbayar', displayName: 'Г.Батбаяр', givenNameMn: 'Батбаяр', patronymicMn: 'Ганболд' },
    ]);
    expect(article.corrections).toEqual([{ date: '2026-01-02', description: 'Тоог зассан', reason: 'Буруу тоо' }]);
    expect(article.author).toEqual({ displayName: refs.author.displayName });
    const raw = JSON.stringify(res.json());
    expect(raw).not.toContain('@newsroom.example');
    expect(raw).not.toContain('deletedAt');
  });

  it('cover exposes WebP variants (url = 1024 variant); unprocessed covers are hidden', async () => {
    const variants = {
      w320: { key: 'media/1/w320.webp', width: 320, height: 180 },
      w1600: { key: 'media/1/w1600.webp', width: 1600, height: 900 },
      w1024: { key: 'media/1/w1024.webp', width: 1024, height: 576 },
      w640: { key: 'media/1/w640.webp', width: 640, height: 360 },
    };
    const [ready] = await app.db
      .insert(media)
      .values({ r2Key: 'originals/a.jpg', mime: 'image/jpeg', status: 'ready', alt: 'Ордон', credit: 'Б.Сараа', width: 1600, height: 900, variants })
      .returning();
    const [pending] = await app.db.insert(media).values({ r2Key: 'originals/b.jpg', mime: 'image/jpeg', status: 'pending', variants }).returning();
    const withCover = await insertArticle(app, refs.author.id, 'published', { coverMediaId: ready!.id });
    const withPending = await insertArticle(app, refs.author.id, 'published', { coverMediaId: pending!.id });

    const cover = publicArticleResponseSchema.parse((await get(`/articles/${withCover.slug}`)).json()).data.cover;
    const hidden = publicArticleResponseSchema.parse((await get(`/articles/${withPending.slug}`)).json()).data.cover;

    expect(cover).toEqual({
      url: 'https://media.test/media/1/w1024.webp',
      variants: [320, 640, 1024, 1600].map((w) => ({ width: w, height: (w * 9) / 16, url: `https://media.test/media/1/w${w}.webp` })),
      alt: 'Ордон',
      credit: 'Б.Сараа',
      width: 1600,
      height: 900,
    });
    expect(JSON.stringify(cover)).not.toContain('originals/');
    expect(hidden).toBeNull();
  });

  it('draft → 404, unpublished (once published) → 410 with longer edge cache', async () => {
    const draft = await insertArticle(app, refs.author.id, 'draft');
    const unpublished = await insertArticle(app, refs.author.id, 'draft', { publishedAt: new Date('2025-01-01') });

    const notFound = await get(`/articles/${draft.slug}`);
    const gone = await get(`/articles/${unpublished.slug}`);

    expect(notFound.statusCode).toBe(404);
    expect(notFound.headers['cache-control']).toBe('public, max-age=30, s-maxage=60');
    expect(gone.statusCode).toBe(410);
    expect(errorCode(gone)).toBe('GONE');
    expect(gone.headers['cache-control']).toBe('public, max-age=300, s-maxage=3600');
  });

  it('bad query → 400 with no-store', async () => {
    const res = await get('/articles?pageSize=1000');

    expect(res.statusCode).toBe(400);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('needs no session cookie', async () => {
    const res = await get('/articles');

    expect(res.statusCode).toBe(200);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('person profile', () => {
  async function seedProfile() {
    const [constituency] = await app.db
      .insert(organizations)
      .values({ type: 'constituency', slug: 'constituency-1-2024', nameMn: '1-р тойрог' })
      .returning();
    const [committee] = await app.db
      .insert(organizations)
      .values({ type: 'committee', slug: 'budget-committee', nameMn: 'Төсвийн байнгын хороо' })
      .returning();
    const base = { personId: refs.personA.id, sourceUrl: SRC };
    await app.db.insert(positions).values([
      { ...base, organizationId: refs.party.id, titleMn: 'Гишүүн', startDate: '2010-03-01' },
      { ...base, organizationId: constituency!.id, titleMn: 'УИХ-ын гишүүн', startDate: '2024-07-02' },
      { ...base, organizationId: committee!.id, titleMn: 'Дарга', startDate: '2020-07-10', endDate: '2024-07-01' },
    ]);
    return { constituency: constituency!, committee: committee! };
  }

  it('profile: current positions, derived party and constituency', async () => {
    await seedProfile();

    const res = await get('/persons/g-batbayar');

    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe(PROFILE);
    const person = publicPersonResponseSchema.parse(res.json()).data;
    expect(person).toMatchObject({ displayName: 'Г.Батбаяр', party: { slug: 'mpp', shortNameMn: 'МАН' }, constituency: { slug: 'constituency-1-2024' } });
    expect(person.currentPositions.map((p) => p.titleMn)).toEqual(['УИХ-ын гишүүн', 'Гишүүн']);
  });

  it('positions history is paginated, newest first, including ended positions', async () => {
    await seedProfile();

    const page1 = (await get('/persons/g-batbayar/positions?pageSize=2')).json() as { data: { titleMn: string; endDate: string | null }[]; pagination: { total: number } };
    const page2 = (await get('/persons/g-batbayar/positions?pageSize=2&page=2')).json() as { data: { titleMn: string }[] };

    expect(page1.pagination.total).toBe(3);
    expect(page1.data.map((p) => p.titleMn)).toEqual(['УИХ-ын гишүүн', 'Дарга']);
    expect(page2.data.map((p) => p.titleMn)).toEqual(['Гишүүн']);
  });

  it('votes, statements, promises, declarations and articles sub-resources', async () => {
    const id = refs.personA.id;
    await app.db.insert(votes).values([
      { billId: refs.bill.id, personId: id, value: 'yes', date: '2025-03-20', motion: 'consideration', sourceUrl: SRC },
      { billId: refs.bill.id, personId: id, value: 'no', date: '2025-04-17', motion: 'final_vote', sourceUrl: SRC },
    ]);
    const draft = await insertArticle(app, refs.author.id, 'draft');
    await app.db.insert(statements).values([
      { personId: id, quoteMn: 'Нийтлэгдсэн', saidOn: '2025-04-17', articleId: refs.article.id, sourceUrl: SRC },
      { personId: id, quoteMn: 'Ноорог', saidOn: '2025-04-01', articleId: draft.id, sourceUrl: SRC },
    ]);
    await app.db.insert(promises).values({ personId: id, textMn: 'Амлалт', madeOn: '2024-06-10', status: 'kept', sourceUrl: SRC });
    await app.db.insert(declarations).values([
      { personId: id, year: 2023, income: '100.00', sourceUrl: SRC },
      { personId: id, year: 2024, income: '200.50', sourceUrl: SRC },
    ]);
    await app.db.insert(articlePersons).values([
      { articleId: refs.article.id, personId: id },
      { articleId: draft.id, personId: id },
    ]);

    const json = async (path: string) => (await get(`/persons/g-batbayar/${path}`)).json() as { data: Record<string, unknown>[] };

    expect((await json('votes')).data.map((v) => [v.motion, v.value])).toEqual([['final_vote', 'no'], ['consideration', 'yes']]);
    expect((await json('votes')).data[0]?.bill).toEqual({ slug: 'tax-bill', titleMn: 'Татварын хуулийн төсөл' });
    const statementList = (await json('statements')).data;
    expect(statementList[0]?.article).toEqual({ slug: refs.article.slug, title: refs.article.title });
    expect(statementList[1]?.article).toBeNull(); // linked article is a draft
    expect((await json('promises')).data).toEqual([expect.objectContaining({ textMn: 'Амлалт', status: 'kept' })]);
    expect((await json('declarations')).data.map((d) => [d.year, d.income])).toEqual([[2024, '200.50'], [2023, '100.00']]);
    expect((await json('articles')).data.map((a) => a.id)).toEqual([refs.article.id]); // drafts excluded
  });

  it('soft-deleted person → 404 on the profile and every sub-resource', async () => {
    await app.db.update(persons).set({ deletedAt: new Date() });

    for (const path of ['', '/positions', '/votes', '/statements', '/promises', '/declarations', '/articles']) {
      const res = await get(`/persons/g-batbayar${path}`);
      expect(res.statusCode, path).toBe(404);
    }
  });
});

describe('organization detail', () => {
  it('lists current, live members only', async () => {
    const base = { organizationId: refs.party.id, titleMn: 'Гишүүн', sourceUrl: SRC };
    await app.db.insert(positions).values([
      { ...base, personId: refs.personA.id, startDate: '2010-03-01' },
      { ...base, personId: refs.personB.id, startDate: '2012-03-01', endDate: '2020-01-01' },
    ]);

    const org = publicOrganizationResponseSchema.parse((await get('/organizations/mpp')).json()).data;
    await app.db.update(persons).set({ deletedAt: new Date() });
    const afterDelete = publicOrganizationResponseSchema.parse((await get('/organizations/mpp')).json()).data;

    expect(org.members.map((m) => m.person.slug)).toEqual(['g-batbayar']);
    expect(afterDelete.members).toEqual([]);
    expect((await get('/organizations/nope')).statusCode).toBe(404);
  });
});

describe('bill detail', () => {
  it('sponsors, ordered stages and votes grouped by (date, motion) with tallies', async () => {
    const [p3] = await app.db.insert(persons).values({ slug: 'ts-temuulen', givenNameMn: 'Тэмүүлэн', patronymicMn: 'Цэрэн' }).returning();
    await app.db.insert(billSponsors).values({ billId: refs.bill.id, personId: refs.personA.id, role: 'initiator' });
    await app.db.insert(billStages).values([
      { billId: refs.bill.id, stage: 'first_reading', date: '2025-04-03', sourceUrl: SRC },
      { billId: refs.bill.id, stage: 'submitted', date: '2025-03-10', sourceUrl: SRC },
    ]);
    const vote = (personId: number, value: 'yes' | 'no' | 'abstain' | 'absent', date: string, motion: string) =>
      ({ billId: refs.bill.id, personId, value, date, motion, sourceUrl: SRC });
    await app.db.insert(votes).values([
      vote(refs.personA.id, 'yes', '2025-04-17', 'final_vote'),
      vote(refs.personB.id, 'no', '2025-04-17', 'final_vote'),
      vote(p3!.id, 'absent', '2025-04-17', 'final_vote'),
      vote(refs.personA.id, 'yes', '2025-03-20', 'consideration'),
      vote(refs.personB.id, 'abstain', '2025-03-20', 'consideration'),
    ]);

    const res = await get('/bills/tax-bill');

    expect(res.headers['cache-control']).toBe(PROFILE);
    const bill = publicBillResponseSchema.parse(res.json()).data;
    expect(bill.sponsors).toEqual([{ person: expect.objectContaining({ slug: 'g-batbayar' }), role: 'initiator' }]);
    expect(bill.stages.map((s) => s.stage)).toEqual(['submitted', 'first_reading']);
    expect(bill.votes.map((g) => [g.date, g.motion, g.tally])).toEqual([
      ['2025-03-20', 'consideration', { yes: 1, no: 0, abstain: 1, absent: 0 }],
      ['2025-04-17', 'final_vote', { yes: 1, no: 1, abstain: 0, absent: 1 }],
    ]);
    expect(bill.votes[1]?.votes).toHaveLength(3);
    expect((await get('/bills/nope')).statusCode).toBe(404);
  });
});
