import {
  authSessionResponseSchema,
  ErrorCode,
  errorResponseSchema,
  loginBodySchema,
  noContentSchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { AppError } from '../../lib/errors';
import { csrfSecurity } from '../../plugins/swagger';
import { csrfTokenFor, deleteSession, login } from './service';

const LOGIN_WINDOW = '15 minutes';

export const authAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  // Per IP + email, to slow down guessing one account's password. Uses createRateLimit (not app.rateLimit)
  // because @fastify/rate-limit lets only one of its request handlers run per request, and the per-IP route
  // limit below already claims that slot.
  const emailLimiter = app.createRateLimit({
    max: 5,
    timeWindow: LOGIN_WINDOW,
    keyGenerator: (request) => `login:${request.ip}:${(request.body as { email: string }).email.toLowerCase()}`,
  });

  app.post(
    '/auth/login',
    {
      // Per IP, across all emails.
      config: { rateLimit: { max: 20, timeWindow: LOGIN_WINDOW } },
      preHandler: async (request, reply) => {
        const limit = await emailLimiter(request);
        if (!limit.isAllowed && limit.isExceeded) {
          reply.header('retry-after', limit.ttlInSeconds);
          throw new AppError(429, ErrorCode.RATE_LIMITED, `Too many login attempts, retry in ${limit.ttlInSeconds}s`);
        }
      },
      schema: {
        tags: ['auth'],
        summary: 'Log in with email and password; sets the session cookie',
        body: loginBodySchema,
        response: { 200: authSessionResponseSchema, 401: errorResponseSchema, 429: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await login(app.db, request.body, {
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
      if (!result) throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password');

      app.setSessionCookie(reply, result.token);
      return { data: { user: result.user, csrfToken: csrfTokenFor(app.env.AUTH_SECRET, result.sessionId) } };
    },
  );

  app.get(
    '/auth/me',
    {
      onRequest: app.requireAuth,
      schema: {
        tags: ['auth'],
        summary: 'Current user and CSRF token',
        response: { 200: authSessionResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request) => {
      const user = request.user!;
      const session = request.session!;
      return { data: { user, csrfToken: csrfTokenFor(app.env.AUTH_SECRET, session.id) } };
    },
  );

  app.post(
    '/auth/logout',
    {
      onRequest: [app.requireAuth, app.verifyCsrf],
      schema: {
        tags: ['auth'],
        summary: 'End the current session',
        security: csrfSecurity,
        response: { 204: noContentSchema, 401: errorResponseSchema, 403: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await deleteSession(app.db, request.session!.id);
      app.clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );
};
