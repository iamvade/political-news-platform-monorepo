import type { FastifyInstance } from 'fastify';
import { correctionsAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function correctionsAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(correctionsAdminRoutes);
}
