import { vi } from 'vitest';

export interface MockRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Headers;
  body: unknown;
}

export type MockHandler = (req: MockRequest) => { status?: number; body?: unknown } | Promise<{ status?: number; body?: unknown }>;

/**
 * Stubs global fetch with handlers keyed by "METHOD /path" (the shared API client calls fetch at request time).
 * Unknown routes answer 404 in the API's error shape. Returns the recorded requests.
 */
export function mockApi(handlers: Record<string, MockHandler>) {
  const calls: MockRequest[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const request: MockRequest = {
      method,
      path: url.pathname,
      query: url.searchParams,
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(request);
    const handler = handlers[`${method} ${url.pathname}`];
    const result = handler ? await handler(request) : { status: 404, body: { error: { code: 'NOT_FOUND', message: 'not mocked' } } };
    const status = result.status ?? 200;
    return new Response(result.body === undefined || status === 204 ? null : JSON.stringify(result.body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const apiError = (status: number, code: string) => ({ status, body: { error: { code, message: code } } });
