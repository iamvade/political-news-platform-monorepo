import type { FastifyInstance } from 'fastify';
import { recordsAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function recordsAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(recordsAdminRoutes);
}
