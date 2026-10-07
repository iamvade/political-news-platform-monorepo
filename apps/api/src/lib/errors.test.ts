import { errorResponseSchema } from '@news/shared/schemas';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { App } from '../app';
import { buildTestApp } from '../test/app';
import { AppError } from './errors';

describe('error format', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildTestApp();
    const r = app.withTypeProvider<ZodTypeProvider>();
    r.get('/__test/validate', { schema: { querystring: z.object({ n: z.coerce.number().int() }) } }, async () => ({
      ok: true,
    }));
    r.get('/__test/app-error', async () => {
      throw new AppError(409, 'SLUG_TAKEN', 'Slug already in use');
    });
    r.get('/__test/crash', async () => {
      throw new Error('secret internal detail');
    });
    r.get('/__test/limited', { config: { rateLimit: { max: 1, timeWindow: '1 minute' } } }, async () => ({
      ok: true,
    }));
    await app.ready();
    await app.redis.flushdb();
  });

  afterAll(async () => {
    await app.close();
  });

  it('unknown route → 404 NOT_FOUND', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' });

    expect(res.statusCode).toBe(404);
    expect(errorResponseSchema.parse(res.json()).error.code).toBe('NOT_FOUND');
  });

  it('schema violation → 400 VALIDATION_ERROR with details', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/validate?n=abc' });

    expect(res.statusCode).toBe(400);
    const body = errorResponseSchema.parse(res.json());
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.[0]?.path).toBe('querystring.n');
  });

  it('AppError → its status and code', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/app-error' });

    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: { code: 'SLUG_TAKEN', message: 'Slug already in use' } });
  });

  it('unexpected error → 500 INTERNAL_ERROR without leaking the message', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/crash' });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  });

  it('rate limit → 429 RATE_LIMITED', async () => {
    await app.inject({ method: 'GET', url: '/__test/limited' });
    const res = await app.inject({ method: 'GET', url: '/__test/limited' });

    expect(res.statusCode).toBe(429);
    expect(errorResponseSchema.parse(res.json()).error.code).toBe('RATE_LIMITED');
  });
});
