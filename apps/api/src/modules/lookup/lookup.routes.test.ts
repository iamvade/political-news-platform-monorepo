import { errorResponseSchema, LOOKUP_KINDS, lookupResponseSchema, type UserRole } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { categories, media, organizations, persons, positions, tags } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { seedRefs, SRC, type Refs } from '../../test/political';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let reporter: TestActor;
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
  reporter = await signIn(app, 'reporter');
  refs = await seedRefs(app);
});

async function lookup(actor: TestActor | null, path: string) {
  const res = await app.inject({ method: 'GET', url: `/v1/admin/lookup/${path}`, cookies: actor?.cookies, headers: actor?.headers });
  return res;
}

const items = (res: { json: () => unknown }) => lookupResponseSchema.parse(res.json()).data;

describe('GET /v1/admin/lookup/:kind', () => {
  it.each(LOOKUP_KINDS)('%s is open to every newsroom role and closed to anonymous users', async (kind) => {
    for (const role of ['reporter', 'editor', 'admin', 'data_editor'] satisfies UserRole[]) {
      const res = await lookup(await signIn(app, role), kind);
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
    }
    const anonymous = await lookup(null, kind);
    expect(anonymous.statusCode).toBe(401);
  });

  it('labels persons as "Б.Нэр" with their current party and the smallest photo variant', async () => {
    const [photo] = await app.db
      .insert(media)
      .values({
        r2Key: 'originals/test/photo.jpg',
        mime: 'image/jpeg',
        status: 'ready',
        alt: 'Хөрөг',
        credit: 'Фото',
        variants: {
          w640: { key: 'variants/photo-640.webp', width: 640, height: 640 },
          w320: { key: 'variants/photo-320.webp', width: 320, height: 320 },
        },
      })
      .returning();
    await app.db.update(persons).set({ photoMediaId: photo!.id }).where(eq(persons.id, refs.personA.id));
    await app.db.insert(positions).values([
      { personId: refs.personA.id, organizationId: refs.party.id, titleMn: 'Гишүүн', startDate: '2020-01-01', sourceUrl: SRC },
      { personId: refs.personB.id, organizationId: refs.party.id, titleMn: 'Гишүүн', startDate: '2016-01-01', endDate: '2019-12-31', sourceUrl: SRC },
    ]);

    const res = await lookup(reporter, `persons?search=${encodeURIComponent('батбаяр')}`);

    expect(res.statusCode).toBe(200);
    expect(items(res)).toEqual([{ id: refs.personA.id, label: 'Г.Батбаяр', sublabel: 'МАН', imageUrl: 'https://media.test/variants/photo-320.webp' }]);
    // An ended party membership is not a sublabel; no photo → null.
    const sarantuya = items(await lookup(reporter, 'persons?search=sarantuya'));
    expect(sarantuya).toEqual([{ id: refs.personB.id, label: 'Д.Сарантуяа', sublabel: null, imageUrl: null }]);
  });

  it('hydrates selected ids (ignoring search) and leaves out soft-deleted rows', async () => {
    await app.db.update(persons).set({ deletedAt: new Date() }).where(eq(persons.id, refs.personB.id));

    const res = await lookup(reporter, `persons?ids=${refs.personA.id},${refs.personB.id}&search=zzz`);

    expect(items(res).map((item) => item.id)).toEqual([refs.personA.id]);
  });

  it('describes organizations, bills, categories and tags', async () => {
    await app.db.insert(organizations).values({ type: 'committee', slug: 'old', nameMn: 'Хуучин хороо', deletedAt: new Date() });
    const [category] = await app.db.insert(categories).values({ slug: 'uls-tor', nameMn: 'Улс төр' }).returning();
    const [tag] = await app.db.insert(tags).values({ slug: 'tosov', nameMn: 'Төсөв' }).returning();

    expect(items(await lookup(reporter, 'organizations'))).toEqual([
      { id: refs.party.id, label: 'Монгол Ардын Нам', sublabel: 'МАН', imageUrl: null },
    ]);
    expect(items(await lookup(reporter, `bills?search=${encodeURIComponent('татвар')}`))).toEqual([
      { id: refs.bill.id, label: 'Татварын хуулийн төсөл', sublabel: null, imageUrl: null },
    ]);
    expect(items(await lookup(reporter, 'categories'))).toEqual([{ id: category!.id, label: 'Улс төр', sublabel: null, imageUrl: null }]);
    expect(items(await lookup(reporter, 'tags?search=tosov'))).toEqual([{ id: tag!.id, label: 'Төсөв', sublabel: null, imageUrl: null }]);
  });

  it('validates ids and limit', async () => {
    for (const query of ['ids=1,abc', 'ids=', 'limit=51', 'limit=0']) {
      const res = await lookup(reporter, `persons?${query}`);
      expect(res.statusCode, query).toBe(400);
      expect(errorResponseSchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
    }
  });
});
