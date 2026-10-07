import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createApiClient } from './client';
import { ApiError } from './errors';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('returns the parsed body on success', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse({ data: { status: 'ok' } }));
    const api = createApiClient({ baseUrl: 'http://api.test/', fetch: fetchMock });

    await expect(api.health.get()).resolves.toEqual({ data: { status: 'ok' } });
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/health', expect.objectContaining({ method: 'GET' }));
  });

  it('serialises query params and skips empty values', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse({ ok: true }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await api.request('/v1/public/things', {
      schema: z.object({ ok: z.boolean() }),
      query: { page: 2, q: 'Оюун', empty: undefined, none: null },
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api.test/v1/public/things?page=2&q=%D0%9E%D1%8E%D1%83%D0%BD');
  });

  it('throws ApiError with code and message from the error body', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () =>
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request',
            details: [{ path: 'body.title', message: 'Required' }],
          },
        },
        400,
      ),
    );
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    const err = await api.health.get().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Invalid request',
      details: [{ path: 'body.title', message: 'Required' }],
    });
  });

  it('throws HTTP_ERROR when the error body is not in the standard shape', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => new Response('Bad gateway', { status: 502 }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await expect(api.health.get()).rejects.toMatchObject({ status: 502, code: 'HTTP_ERROR' });
  });

  it('throws INVALID_RESPONSE when a 2xx body does not match the schema', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => jsonResponse({ data: { status: 'down' } }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await expect(api.health.get()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('throws NETWORK_ERROR when fetch rejects', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await expect(api.health.get()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('sends X-CSRF-Token on non-GET requests only', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, getCsrfToken: () => 'csrf-123' });

    await api.auth.logout();
    await api.request('/v1/admin/things', { schema: z.undefined() });

    const headersOf = (call: number) => new Headers(fetchMock.mock.calls[call]?.[1]?.headers);
    expect(headersOf(0).get('X-CSRF-Token')).toBe('csrf-123');
    expect(headersOf(1).get('X-CSRF-Token')).toBeNull();
  });

  it('admin resources and public reads hit the right paths and methods', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>(async () => new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, getCsrfToken: () => 'csrf' });

    await api.admin.votes.remove(5);
    await expect(api.public.persons.get('г-батбаяр')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    await expect(api.public.persons.votes('g-batbayar', { page: 2 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });

    expect(fetchMock.mock.calls.map(([url, init]) => [init?.method, url])).toEqual([
      ['DELETE', 'http://api.test/v1/admin/votes/5'],
      ['GET', 'http://api.test/v1/public/persons/%D0%B3-%D0%B1%D0%B0%D1%82%D0%B1%D0%B0%D1%8F%D1%80'],
      ['GET', 'http://api.test/v1/public/persons/g-batbayar/votes?page=2'],
    ]);
  });

  it('uploadFile: presign → direct PUT (no API headers) → confirm', async () => {
    const media = {
      id: 7, status: 'pending', mime: 'image/jpeg', width: null, height: null, byteSize: 4, originalFilename: 'a.jpg',
      alt: null, credit: null, processingError: null, uploadedBy: 1, variants: [], createdAt: '2026-10-07T00:00:00.000Z', updatedAt: '2026-10-07T00:00:00.000Z',
    };
    const fetchMock = vi.fn<typeof globalThis.fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/v1/admin/media/uploads')) {
        return jsonResponse({ data: { media, upload: { url: 'https://storage.test/put', method: 'PUT', headers: { 'content-type': 'image/jpeg' }, expiresAt: '2026-10-07T00:10:00.000Z' } } }, 201);
      }
      if (url === 'https://storage.test/put') return new Response(null, { status: 200 });
      return jsonResponse({ data: { ...media, status: 'processing' } });
    });
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock, getCsrfToken: () => 'csrf' });

    const result = await api.admin.media.uploadFile(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }), { filename: 'a.jpg' });

    expect(result.data.status).toBe('processing');
    const put = fetchMock.mock.calls[1]!;
    expect(put[0]).toBe('https://storage.test/put');
    expect(new Headers(put[1]?.headers).get('x-csrf-token')).toBeNull();
    expect(new Headers(put[1]?.headers).get('content-type')).toBe('image/jpeg');
    expect(String(fetchMock.mock.calls[2]![0])).toBe('http://api.test/v1/admin/media/7/confirm');
  });

  it('uploadFile rejects unsupported types before contacting the API', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>();
    const api = createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });

    await expect(api.admin.media.uploadFile(new Blob(['x'], { type: 'image/gif' }), { filename: 'a.gif' })).rejects.toThrow('Unsupported file type');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
