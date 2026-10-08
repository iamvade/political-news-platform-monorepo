// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnv } from '@/lib/env';
import { articleSummary } from '@/test/fixtures';
import { GET } from './route';

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const article = { ...articleSummary({ cover: null }), bodyHtml: '<p>a</p>', bodyJson: { type: 'doc', content: [] }, author: { displayName: 'Б.Сараа' }, tags: [], persons: [], organizations: [], bills: [], corrections: [] };

const get = (idSlug: string) => GET(new Request(`http://web.test/news/${idSlug}/share-card?v=abc`), { params: Promise.resolve({ idSlug }) });

// next/og loads its WebAssembly through fetch too, so only API requests go to the mock.
const realFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test');
  resetServerEnv();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
    String(input instanceof Request ? input.url : input).startsWith('http://api.test/') ? fetchMock(input, init) : realFetch(input, init),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET /news/{id}-{slug}/share-card', () => {
  it('renders a 1200×630 PNG that the CDN may keep (the URL is versioned)', async () => {
    fetchMock.mockImplementation(async () => json({ data: article }));

    const res = await get('42-ikh-khural-tosviig-batlav');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(res.headers.get('cache-control')).toBe('public, max-age=86400, s-maxage=31536000, immutable');
    const png = new Uint8Array(await res.arrayBuffer());
    // PNG signature, then the IHDR chunk's width and height (big-endian at bytes 16–23).
    expect([...png.slice(1, 4)].map((b) => String.fromCharCode(b)).join('')).toBe('PNG');
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
  }, 20_000);

  it('is not found for a malformed segment, without calling the API', async () => {
    await expect(get('not-an-id')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([404, 410])('is not found when the API answers %i', async (status) => {
    fetchMock.mockImplementation(async () => json({ error: { code: 'NOT_FOUND', message: 'x' } }, status));
    await expect(get('42-ikh-khural-tosviig-batlav')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('is not found when the id in the URL is not the article\'s', async () => {
    fetchMock.mockImplementation(async () => json({ data: article }));
    await expect(get('7-ikh-khural-tosviig-batlav')).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
