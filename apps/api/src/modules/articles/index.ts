import type { FastifyInstance } from 'fastify';
import { articleAdminRoutes } from './admin.routes';
import { articlePublicRoutes } from './public.routes';

/** Register inside the protected /v1/admin scope. */
export async function articlesAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(articleAdminRoutes);
}

/** Register inside the /v1/public scope. */
export async function articlesPublicModule(app: FastifyInstance): Promise<void> {
  await app.register(articlePublicRoutes);
}
