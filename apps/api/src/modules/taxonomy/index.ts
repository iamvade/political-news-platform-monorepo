import type { FastifyInstance } from 'fastify';
import { taxonomyAdminRoutes } from './admin.routes';
import { taxonomyPublicRoutes } from './public.routes';

/** Register inside the protected /v1/admin scope. */
export async function taxonomyAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(taxonomyAdminRoutes);
}

/** Register inside the /v1/public scope. */
export async function taxonomyPublicModule(app: FastifyInstance): Promise<void> {
  await app.register(taxonomyPublicRoutes);
}
