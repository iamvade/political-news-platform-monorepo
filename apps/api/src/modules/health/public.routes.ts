import { ErrorCode, errorResponseSchema, healthResponseSchema, readinessResponseSchema } from '@news/shared/schemas';
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { AppError } from '../../lib/errors';

const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms).unref()),
  ]);
}

export const healthPublicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['health'],
        summary: 'Liveness probe',
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({ data: { status: 'ok' as const } }),
  );

  app.get(
    '/health/ready',
    {
      config: { rateLimit: false },
      schema: {
        tags: ['health'],
        summary: 'Readiness probe (database + Redis)',
        response: { 200: readinessResponseSchema, 503: errorResponseSchema },
      },
    },
    async (request) => {
      const [database, redis] = await Promise.allSettled([
        withTimeout(app.db.execute(sql`select 1`), CHECK_TIMEOUT_MS),
        withTimeout(app.redis.ping(), CHECK_TIMEOUT_MS),
      ]);

      const failed = [database.status === 'rejected' && 'database', redis.status === 'rejected' && 'redis'].filter(
        Boolean,
      );
      if (failed.length > 0) {
        request.log.warn({ database, redis }, 'Readiness check failed');
        throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, `Unavailable: ${failed.join(', ')}`);
      }

      return { data: { status: 'ok' as const, checks: { database: 'ok' as const, redis: 'ok' as const } } };
    },
  );
};
