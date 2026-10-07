import type { FastifyInstance } from 'fastify';
import { healthPublicRoutes } from './public.routes';

/** Health probes are unversioned so infrastructure can reach them at a fixed path. */
export async function healthModule(app: FastifyInstance): Promise<void> {
  await app.register(healthPublicRoutes);
}
