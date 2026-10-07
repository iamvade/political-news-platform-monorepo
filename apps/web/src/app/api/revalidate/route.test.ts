// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetServerEnv } from '@/lib/env';
import { POST } from './route';

const revalidateTag = vi.hoisted(() => vi.fn());
vi.mock('next/cache', () => ({ revalidateTag }));

const SECRET = 's'.repeat(32);

function post(body: unknown, secret: string | null = SECRET) {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (secret !== null) headers.set('x-revalidate-secret', secret);
  return POST(new Request('http://web.test/api/revalidate', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) }));
}

beforeEach(() => {
  vi.stubEnv('API_URL', 'http://api.test');
  vi.stubEnv('WEB_REVALIDATE_SECRET', SECRET);
  resetServerEnv();
  revalidateTag.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetServerEnv();
});

describe('POST /api/revalidate', () => {
  it('revalidates each distinct tag with the "max" profile', async () => {
    const res = await post({ tags: ['article:42', 'homepage', 'articles', 'homepage'] });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { revalidated: ['article:42', 'homepage', 'articles'] } });
    expect(revalidateTag.mock.calls).toEqual([
      ['article:42', 'max'],
      ['homepage', 'max'],
      ['articles', 'max'],
    ]);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it.each([
    ['a missing secret header', null],
    ['a wrong secret', 'x'.repeat(32)],
  ])('rejects %s with 401', async (_label, secret) => {
    const res = await post({ tags: ['homepage'] }, secret);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('UNAUTHORIZED');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ['non-JSON', 'tags=homepage'],
    ['no tags', { tags: [] }],
    ['an invalid tag', { tags: ['Home Page'] }],
    ['too many tags', { tags: Array.from({ length: 51 }, (_, i) => `article:${i}`) }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('answers 503 when no secret is configured', async () => {
    vi.stubEnv('WEB_REVALIDATE_SECRET', '');
    delete process.env.WEB_REVALIDATE_SECRET;
    resetServerEnv();
    const res = await post({ tags: ['homepage'] });
    expect(res.status).toBe(503);
  });
});
