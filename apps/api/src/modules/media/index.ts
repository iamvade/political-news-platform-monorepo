import type { FastifyInstance } from 'fastify';
import { mediaAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function mediaAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(mediaAdminRoutes);
}
