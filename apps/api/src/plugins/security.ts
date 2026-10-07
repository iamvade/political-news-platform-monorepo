import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ErrorCode } from '@news/shared/schemas';
import fp from 'fastify-plugin';
import type { Env } from '../config/env';
import { AppError } from '../lib/errors';

export const securityPlugin = fp<{ env: Env }>(
  async (app, { env }) => {
    await app.register(helmet, {
      // JSON API: no HTML except Swagger UI in development, which sets its own CSP.
      contentSecurityPolicy: env.NODE_ENV === 'development' ? false : undefined,
    });

    await app.register(cors, {
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    await app.register(rateLimit, {
      global: true,
      max: env.RATE_LIMIT_MAX,
      timeWindow: env.RATE_LIMIT_WINDOW,
      redis: app.redis,
      nameSpace: 'rl:',
      // If Redis is down, serve requests rather than reject them.
      skipOnError: true,
      errorResponseBuilder: (_request, context) =>
        new AppError(429, ErrorCode.RATE_LIMITED, `Too many requests, retry in ${context.after}`),
    });
  },
  { name: 'security', dependencies: ['redis'] },
);
