import Fastify, { type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Env } from './config/env';
import { registerErrorHandlers } from './lib/errors';
import type { Jobs } from './jobs/types';
import type { ObjectStorage } from './lib/storage';
import { articlesAdminModule, articlesPublicModule } from './modules/articles/index';
import { authModule } from './modules/auth/index';
import { correctionsAdminModule } from './modules/corrections/index';
import { legislationAdminModule, legislationPublicModule } from './modules/legislation/index';
import { mediaAdminModule } from './modules/media/index';
import { peopleAdminModule, peoplePublicModule } from './modules/people/index';
import { recordsAdminModule } from './modules/records/index';
import { lookupAdminModule } from './modules/lookup/index';
import { taxonomyAdminModule, taxonomyPublicModule } from './modules/taxonomy/index';
import { publicCacheHook } from './lib/cache';
import { healthModule } from './modules/health/index';
import { authPlugin } from './plugins/auth';
import { dbPlugin } from './plugins/db';
import { jobsPlugin } from './plugins/jobs';
import { storagePlugin } from './plugins/storage';
import { redisPlugin } from './plugins/redis';
import { securityPlugin } from './plugins/security';
import { swaggerPlugin } from './plugins/swagger';

function loggerOptions(env: Env): FastifyServerOptions['logger'] {
  return {
    level: env.LOG_LEVEL,
    redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    ...(env.NODE_ENV === 'development' && {
      transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } },
    }),
  };
}

/** Builds the app without listening. Used by server.ts and by tests via `inject()`. */
export interface BuildAppOptions {
  /** Inject a fake in tests; defaults to BullMQ. */
  jobs?: Jobs;
  /** Inject a fake in tests (null = not configured); defaults to S3/R2 from env. */
  storage?: ObjectStorage | null;
}

export async function buildApp(env: Env, options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: loggerOptions(env),
    trustProxy: env.TRUST_PROXY,
  }).withTypeProvider<ZodTypeProvider>();

  app.decorate('env', env);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandlers(app);

  await app.register(dbPlugin, { url: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await app.register(securityPlugin, { env });
  await app.register(authPlugin);
  await app.register(jobsPlugin, { jobs: options.jobs });
  await app.register(storagePlugin, { client: options.storage });
  if (env.NODE_ENV === 'development') await app.register(swaggerPlugin);

  await app.register(healthModule);

  await app.register(
    async (v1) => {
      // Public, unauthenticated, CDN-cacheable reads. Every response gets a Cache-Control header (lib/cache.ts).
      await v1.register(
        async (pub) => {
          pub.addHook('onSend', publicCacheHook);
          await pub.register(articlesPublicModule);
          await pub.register(taxonomyPublicModule);
          await pub.register(peoplePublicModule);
          await pub.register(legislationPublicModule);
        },
        { prefix: '/public' },
      );
      await v1.register(
        async (admin) => {
          admin.addHook('onRequest', admin.verifyOrigin);
          await admin.register(authModule);

          // Everything registered in here requires a session, and a CSRF token on non-GET requests.
          // onRequest (not preHandler) so auth runs before body validation: anonymous callers get 401, never 400.
          // Admin domain modules register their admin.routes.ts in this scope and add requireRole(...) per route.
          await admin.register(async (protectedAdmin) => {
            protectedAdmin.addHook('onRequest', protectedAdmin.requireAuth);
            protectedAdmin.addHook('onRequest', protectedAdmin.verifyCsrf);
            protectedAdmin.addHook('onRequest', async (_request, reply) => {
              reply.header('cache-control', 'no-store');
            });

            await protectedAdmin.register(articlesAdminModule);
            await protectedAdmin.register(peopleAdminModule);
            await protectedAdmin.register(legislationAdminModule);
            await protectedAdmin.register(recordsAdminModule);
            await protectedAdmin.register(correctionsAdminModule);
            await protectedAdmin.register(mediaAdminModule);
            await protectedAdmin.register(lookupAdminModule);
            await protectedAdmin.register(taxonomyAdminModule);
          });
        },
        { prefix: '/admin' },
      );
    },
    { prefix: '/v1' },
  );

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
