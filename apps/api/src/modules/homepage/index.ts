import type { FastifyInstance } from 'fastify';
import { homepageAdminRoutes } from './admin.routes';
import { homepagePublicRoutes } from './public.routes';

/** Register inside the protected /v1/admin scope. */
export async function homepageAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(homepageAdminRoutes);
}

/** Register inside the /v1/public scope. */
export async function homepagePublicModule(app: FastifyInstance): Promise<void> {
  await app.register(homepagePublicRoutes);
}
