import {
  adminHomepageResponseSchema,
  errorResponseSchema,
  homepageVersionListResponseSchema,
  publicHomepageResponseSchema,
  type HomepageZones,
  type UserRole,
} from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { articles, auditLog, categories } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { insertArticle } from '../../test/articles';
import type { FakeJobs } from '../../test/fake-jobs';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let editor: TestActor;
let cat: { politics: number; economy: number; child: number };
/** Published p1…p8 (p8 newest), d1 draft. */
let ids: { p: number[]; draft: number };

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
  (app.jobs as FakeJobs).reset();
  editor = await signIn(app, 'editor');
  const [politics] = await app.db.insert(categories).values({ slug: 'uls-tor', nameMn: 'Улс төр', sortOrder: 2 }).returning();
  const [economy] = await app.db.insert(categories).values({ slug: 'ediin-zasag', nameMn: 'Эдийн засаг', sortOrder: 1 }).returning();
  const [child] = await app.db.insert(categories).values({ slug: 'songuul', nameMn: 'Сонгууль', parentId: politics!.id }).returning();
  cat = { politics: politics!.id, economy: economy!.id, child: child!.id };

  const p: number[] = [];
  for (let i = 1; i <= 8; i++) {
    const row = await insertArticle(app, editor.user.id, 'published', {
      categoryId: i % 2 ? cat.politics : cat.economy,
      publishedAt: new Date(Date.UTC(2026, 0, i)),
    });
    p.push(row.id);
  }
  const draft = await insertArticle(app, editor.user.id, 'draft', { categoryId: cat.politics });
  ids = { p, draft: draft.id };
});

function call(actor: TestActor | null, method: 'GET' | 'PUT', url: string, payload?: unknown) {
  return app.inject({ method, url, payload: payload as object | undefined, cookies: actor?.cookies, headers: actor?.headers });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;
const zones = (overrides: Partial<HomepageZones> = {}): HomepageZones => ({
  heroArticleId: ids.p[0]!,
  featuredArticleIds: [ids.p[1]!, ids.p[2]!],
  sectionCategoryIds: [cat.economy, cat.politics],
  ...overrides,
});
const save = (body: { zones: HomepageZones; expectedVersion: number | null }, actor: TestActor | null = editor) =>
  call(actor, 'PUT', '/v1/admin/homepage', body);

describe('admin homepage', () => {
  it('starts empty, then each save becomes the new live version', async () => {
    const initial = adminHomepageResponseSchema.parse((await call(editor, 'GET', '/v1/admin/homepage')).json()).data;
    expect(initial).toMatchObject({ version: null, zones: { heroArticleId: null, featuredArticleIds: [], sectionCategoryIds: [] } });

    const first = await save({ zones: zones(), expectedVersion: null });
    expect(first.statusCode, first.body).toBe(200);
    const v1 = adminHomepageResponseSchema.parse(first.json()).data;
    expect(v1.version).toEqual(expect.any(Number));
    expect(v1.articles.map((a) => a.id).sort()).toEqual([ids.p[0], ids.p[1], ids.p[2]].sort());
    expect(v1.categories.map((c) => c.nameMn).sort()).toEqual(['Улс төр', 'Эдийн засаг']);

    const second = adminHomepageResponseSchema.parse((await save({ zones: zones({ featuredArticleIds: [] }), expectedVersion: v1.version })).json()).data;
    expect(second.version).toBeGreaterThan(v1.version!);

    const versions = homepageVersionListResponseSchema.parse((await call(editor, 'GET', '/v1/admin/homepage/versions')).json());
    expect(versions.data.map((v) => v.version)).toEqual([second.version, v1.version]);
    expect(versions.data[1]!.zones.featuredArticleIds).toEqual([ids.p[1], ids.p[2]]);
  });

  it('audits the save and asks the web to revalidate home after commit', async () => {
    const res = await save({ zones: zones(), expectedVersion: null });
    const version = adminHomepageResponseSchema.parse(res.json()).data.version!;

    const [entry] = await app.db.select().from(auditLog).where(eq(auditLog.entityType, 'homepage_layout'));
    expect(entry).toMatchObject({ action: 'create', entityId: version, actorId: editor.user.id });
    expect((app.jobs as FakeJobs).calls).toEqual([{ type: 'enqueueHomepageChanged' }]);
  });

  it('rejects a stale expectedVersion with EDIT_CONFLICT', async () => {
    await save({ zones: zones(), expectedVersion: null });

    const stale = await save({ zones: zones(), expectedVersion: null });

    expect(stale.statusCode).toBe(409);
    expect(errorCode(stale)).toBe('EDIT_CONFLICT');
    expect((app.jobs as FakeJobs).calls).toHaveLength(1);
  });

  it.each([
    ['a draft article', () => zones({ heroArticleId: ids.draft }), 400, 'ARTICLE_NOT_PUBLISHED'],
    ['an unknown article', () => zones({ featuredArticleIds: [999999] }), 400, 'REFERENCE_NOT_FOUND'],
    ['an unknown category', () => zones({ sectionCategoryIds: [999999] }), 400, 'REFERENCE_NOT_FOUND'],
    ['the hero also featured', () => zones({ featuredArticleIds: [ids.p[0]!] }), 400, 'VALIDATION_ERROR'],
    ['five featured articles', () => zones({ heroArticleId: null, featuredArticleIds: ids.p.slice(0, 5) }), 400, 'VALIDATION_ERROR'],
  ])('rejects %s', async (_label, makeZones, status, code) => {
    const res = await save({ zones: makeZones(), expectedVersion: null });

    expect(res.statusCode).toBe(status);
    expect(errorCode(res)).toBe(code);
  });

  it('rejects a soft-deleted article', async () => {
    await app.db.update(articles).set({ deletedAt: new Date() }).where(eq(articles.id, ids.p[1]!));

    const res = await save({ zones: zones(), expectedVersion: null });

    expect(errorCode(res)).toBe('REFERENCE_NOT_FOUND');
  });

  it.each<[UserRole | 'anonymous', number]>([
    ['anonymous', 401],
    ['reporter', 403],
    ['data_editor', 403],
    ['admin', 200],
  ])('%s → %i', async (role, status) => {
    const actor = role === 'anonymous' ? null : await signIn(app, role);
    expect((await call(actor, 'GET', '/v1/admin/homepage')).statusCode).toBe(status);
    expect((await save({ zones: zones(), expectedVersion: null }, actor)).statusCode).toBe(status);
  });
});

describe('GET /v1/public/homepage', () => {
  const getPublic = async () => {
    const res = await call(null, 'GET', '/v1/public/homepage');
    expect(res.statusCode, res.body).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400');
    return publicHomepageResponseSchema.parse(res.json()).data;
  };
  /** Published article n (1 = oldest, 8 = newest). */
  const p = (n: number) => ids.p[n - 1]!;

  it('falls back to the latest articles and top-level categories when nothing was saved', async () => {
    const home = await getPublic();

    expect(home.updatedAt).toBeNull();
    expect(home.hero?.id).toBe(p(8));
    expect(home.featured.map((a) => a.id)).toEqual([p(7), p(6), p(5), p(4)]);
    expect(home.sections.map((s) => s.category.slug)).toEqual(['ediin-zasag', 'uls-tor']);
    // Section rails skip what the hero and featured slots already show.
    expect(home.sections[1]!.articles.map((a) => a.id)).toEqual([p(3), p(1)]);
  });

  it('serves the saved layout in the editor order', async () => {
    await save({ zones: zones(), expectedVersion: null });

    const home = await getPublic();

    expect(home.updatedAt).not.toBeNull();
    expect(home.hero?.id).toBe(p(1));
    // Two pinned, filled up to four with the newest others.
    expect(home.featured.map((a) => a.id)).toEqual([p(2), p(3), p(8), p(7)]);
    expect(home.sections.map((s) => s.category.slug)).toEqual(['ediin-zasag', 'uls-tor']);
    expect(home.sections.flatMap((s) => s.articles.map((a) => a.id))).not.toContain(p(1));
  });

  it('drops pinned articles that were unpublished and refills the slot', async () => {
    await save({ zones: zones(), expectedVersion: null });
    await app.db.update(articles).set({ status: 'draft' }).where(eq(articles.id, ids.p[0]!));

    const home = await getPublic();

    expect(home.hero?.id).not.toBe(p(1));
    expect([home.hero, ...home.featured].map((a) => a?.id)).not.toContain(p(1));
    expect(home.featured).toHaveLength(4);
  });

  it('shows no sections when the editor removed them all', async () => {
    await save({ zones: zones({ sectionCategoryIds: [] }), expectedVersion: null });

    expect((await getPublic()).sections).toEqual([]);
  });
});
