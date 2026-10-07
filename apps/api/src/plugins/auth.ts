import cookie from '@fastify/cookie';
import { ErrorCode, type AuthUser, type UserRole } from '@news/shared/schemas';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { AppError } from '../lib/errors';
import {
  isValidCsrfToken,
  loadSession,
  SESSION_ABSOLUTE_TTL_MS,
  SESSION_COOKIE,
} from '../modules/auth/service';

type AuthHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth / requireRole. Null on public routes. */
    user: AuthUser | null;
    session: { id: string } | null;
  }
  interface FastifyInstance {
    /** onRequest hook: 401 unless a valid session cookie is present. Use onRequest so it runs before validation. */
    requireAuth: AuthHook;
    /** onRequest hook factory: requireAuth + 403 unless the user's role is listed. Roles are explicit (admin is not implied). */
    requireRole: (...roles: UserRole[]) => AuthHook;
    /** onRequest: 403 for state-changing requests from an Origin not in CORS_ORIGINS. */
    verifyOrigin: AuthHook;
    /** onRequest hook: 403 unless a state-changing request carries the session's X-CSRF-Token. */
    verifyCsrf: AuthHook;
    setSessionCookie: (reply: FastifyReply, token: string) => void;
    clearSessionCookie: (reply: FastifyReply) => void;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const authPlugin = fp(
  async (app) => {
    const { env } = app;
    await app.register(cookie);

    app.decorateRequest('user', null);
    app.decorateRequest('session', null);

    const cookieOptions = {
      httpOnly: true,
      secure: env.SESSION_COOKIE_SECURE,
      sameSite: 'strict',
      path: '/',
    } as const;

    app.decorate('setSessionCookie', (reply: FastifyReply, token: string) => {
      reply.setCookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_ABSOLUTE_TTL_MS / 1000 });
    });
    app.decorate('clearSessionCookie', (reply: FastifyReply) => {
      reply.clearCookie(SESSION_COOKIE, cookieOptions);
    });

    const requireAuth: AuthHook = async (request, reply) => {
      if (request.user) return;
      const token = request.cookies[SESSION_COOKIE];
      if (!token) throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');

      const result = await loadSession(app.db, token);
      if (result.status !== 'ok') {
        app.clearSessionCookie(reply);
        if (result.status === 'expired') {
          throw new AppError(401, ErrorCode.SESSION_EXPIRED, 'Session expired');
        }
        throw new AppError(401, ErrorCode.UNAUTHORIZED, 'Authentication required');
      }
      request.user = result.user;
      request.session = { id: result.sessionId };
    };
    app.decorate('requireAuth', requireAuth);

    app.decorate('requireRole', (...roles: UserRole[]): AuthHook => {
      return async (request, reply) => {
        await requireAuth(request, reply);
        if (!request.user || !roles.includes(request.user.role)) {
          throw new AppError(403, ErrorCode.FORBIDDEN, 'Insufficient role');
        }
      };
    });

    app.decorate('verifyOrigin', async (request: FastifyRequest) => {
      if (SAFE_METHODS.has(request.method)) return;
      const origin = request.headers.origin;
      if (!origin) return;
      // Same-origin requests (e.g. Swagger UI served by this API) cannot be cross-site forgeries.
      // `request.host` includes the port; with TRUST_PROXY it comes from X-Forwarded-Host.
      const sameOrigin = origin === `${request.protocol}://${request.host}`;
      if (!sameOrigin && !env.CORS_ORIGINS.includes(origin)) {
        throw new AppError(403, ErrorCode.CSRF_INVALID, 'Origin not allowed');
      }
    });

    app.decorate('verifyCsrf', async (request: FastifyRequest, reply: FastifyReply) => {
      if (SAFE_METHODS.has(request.method)) return;
      await requireAuth(request, reply);
      const header = request.headers['x-csrf-token'];
      const provided = Array.isArray(header) ? header[0] : header;
      if (!request.session || !isValidCsrfToken(env.AUTH_SECRET, request.session.id, provided)) {
        throw new AppError(403, ErrorCode.CSRF_INVALID, 'Missing or invalid CSRF token');
      }
    });
  },
  { name: 'auth', dependencies: ['db'] },
);
