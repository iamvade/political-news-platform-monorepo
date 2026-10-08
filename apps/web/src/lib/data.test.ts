// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { articleSummary } from '@/test/fixtures';
import { duringBuildOr, getArticle, getCategory, getCategoryArticles, getHomepage, getLatestArticles, getPerson, getRelatedArticles } from './data';
import { resetServerEnv } from './env';

const fetchMock = vi.fn<typeof fetch>();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const lastInit = () => fetchMock.mock.calls.at(-1)![1] as RequestInit & { next?: { tags: string[]; revalidate: number } };

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test');
  resetServerEnv();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const article = { ...articleSummary(), bodyHtml: '<p>a</p>', bodyJson: { type: 'doc', content: [] }, author: { displayName: 'Б.Сараа' }, tags: [], persons: [], organizations: [], bills: [], corrections: [] };

describe('data layer', () => {
  it('caches the homepage under the "homepage" tag', async () => {
    fetchMock.mockImplementation(async () => json({ data: { hero: null, featured: [], sections: [], updatedAt: null } }));

    await getHomepage();

    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://api.test/v1/public/homepage');
    expect(lastInit()).toMatchObject({ cache: 'force-cache', next: { tags: ['homepage'], revalidate: 300 } });
  });

  it('tags article lists for the homepage and article lists', async () => {
    fetchMock.mockImplementation(async () => json({ data: [], pagination: { page: 1, pageSize: 15, total: 0, totalPages: 0 } }));

    await getLatestArticles(15);

    expect(lastInit().next?.tags).toEqual(['homepage', 'articles']);
  });

  it('tags an article by the id in its URL and checks the id', async () => {
    fetchMock.mockImplementation(async () => json({ data: article }));

    await expect(getArticle(42, article.slug)).resolves.toMatchObject({ id: 42 });
    expect(lastInit().next?.tags).toEqual(['article:42']);
    await expect(getArticle(7, article.slug)).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it.each([404, 410])('turns API %i into not-found', async (status) => {
    fetchMock.mockImplementation(async () => json({ error: { code: status === 410 ? 'GONE' : 'NOT_FOUND', message: 'x' } }, status));
    await expect(getArticle(42, 'x')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('related articles: same category, tagged "articles", without the article itself', async () => {
    const list = [articleSummary({ id: 42 }), articleSummary({ id: 41 }), articleSummary({ id: 40 })];
    fetchMock.mockImplementation(async () => json({ data: list, pagination: { page: 1, pageSize: 3, total: 3, totalPages: 1 } }));

    const related = await getRelatedArticles(article, 2);

    expect(related.map((a) => a.id)).toEqual([41, 40]);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://api.test/v1/public/articles?pageSize=3&category=uls-tor');
    expect(lastInit()).toMatchObject({ cache: 'force-cache', next: { tags: ['articles'], revalidate: 300 } });
  });

  it('related articles: the latest ones when the article has no category, at most `count`', async () => {
    const list = [articleSummary({ id: 50 }), articleSummary({ id: 49 }), articleSummary({ id: 48 })];
    fetchMock.mockImplementation(async () => json({ data: list, pagination: { page: 1, pageSize: 3, total: 3, totalPages: 1 } }));

    const related = await getRelatedArticles({ ...article, category: null }, 2);

    expect(related.map((a) => a.id)).toEqual([50, 49]);
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://api.test/v1/public/articles?pageSize=3');
  });

  it('category: tagged category:{slug}, kept an hour, 404 becomes not-found', async () => {
    fetchMock.mockImplementation(async () => json({ data: { slug: 'uls-tor', nameMn: 'Улс төр', nameEn: null } }));

    await expect(getCategory('uls-tor')).resolves.toEqual({ slug: 'uls-tor', nameMn: 'Улс төр', nameEn: null });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://api.test/v1/public/categories/uls-tor');
    expect(lastInit()).toMatchObject({ cache: 'force-cache', next: { tags: ['category:uls-tor'], revalidate: 3600 } });

    fetchMock.mockImplementation(async () => json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404));
    await expect(getCategory('nope')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('category articles: one page, tagged with the category and "articles"', async () => {
    fetchMock.mockImplementation(async () => json({ data: [articleSummary()], pagination: { page: 2, pageSize: 20, total: 21, totalPages: 2 } }));

    const result = await getCategoryArticles('uls-tor', 2);

    expect(result.pagination).toEqual({ page: 2, pageSize: 20, total: 21, totalPages: 2 });
    expect(String(fetchMock.mock.calls[0]![0])).toBe('http://api.test/v1/public/categories/uls-tor/articles?page=2&pageSize=20');
    expect(lastInit()).toMatchObject({ next: { tags: ['category:uls-tor', 'articles'], revalidate: 300 } });
  });

  it('tags a person with person:{id} and people', async () => {
    fetchMock.mockImplementation(async () => json({ error: { code: 'NOT_FOUND', message: 'x' } }, 404));
    await expect(getPerson(12, 'g-batbayar')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(lastInit().next?.tags).toEqual(['person:12', 'people']);
  });

  it('passes other API errors through (error page, ISR keeps the last good page)', async () => {
    fetchMock.mockImplementation(async () => json({ error: { code: 'INTERNAL_ERROR', message: 'x' } }, 500));
    await expect(getHomepage()).rejects.toMatchObject({ status: 500 });
  });
});

describe('duringBuildOr', () => {
  const failing = () => Promise.reject(new Error('ECONNREFUSED'));

  it('falls back only during next build', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(duringBuildOr(failing, null)).resolves.toBeNull();

    vi.stubEnv('NEXT_PHASE', 'phase-production-server');
    await expect(duringBuildOr(failing, null)).rejects.toThrow('ECONNREFUSED');
  });
});
