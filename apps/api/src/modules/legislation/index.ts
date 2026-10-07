import type { FastifyInstance } from 'fastify';
import { legislationPublicRoutes } from './public.routes';
import { legislationAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function legislationAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(legislationAdminRoutes);
}

/** Register inside the /v1/public scope. */
export async function legislationPublicModule(app: FastifyInstance): Promise<void> {
  await app.register(legislationPublicRoutes);
}
