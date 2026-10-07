import type { FastifyInstance } from 'fastify';
import { lookupAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function lookupAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(lookupAdminRoutes);
}
