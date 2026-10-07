import { healthResponseSchema, readinessResponseSchema } from '@news/shared/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { buildTestApp } from '../../test/app';

describe('health routes', () => {
  let app: App;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    expect(healthResponseSchema.parse(res.json())).toEqual({ data: { status: 'ok' } });
  });

  it('GET /health/ready checks database and Redis', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(res.statusCode).toBe(200);
    expect(readinessResponseSchema.parse(res.json())).toEqual({
      data: { status: 'ok', checks: { database: 'ok', redis: 'ok' } },
    });
  });
});
