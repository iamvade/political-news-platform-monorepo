import type { FastifyInstance } from 'fastify';
import { peoplePublicRoutes } from './public.routes';
import { peopleAdminRoutes } from './admin.routes';

/** Register inside the protected /v1/admin scope. */
export async function peopleAdminModule(app: FastifyInstance): Promise<void> {
  await app.register(peopleAdminRoutes);
}

/** Register inside the /v1/public scope. */
export async function peoplePublicModule(app: FastifyInstance): Promise<void> {
  await app.register(peoplePublicRoutes);
}
