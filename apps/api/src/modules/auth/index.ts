import type { FastifyInstance } from 'fastify';
import { authAdminRoutes } from './admin.routes';

/** Registered under /v1/admin, outside the protected scope (login must work without a session). */
export async function authModule(app: FastifyInstance): Promise<void> {
  await app.register(authAdminRoutes);
}
