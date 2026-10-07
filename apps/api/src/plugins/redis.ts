import fp from 'fastify-plugin';
import { Redis } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp<{ url: string }>(
  async (app, opts) => {
    const redis = new Redis(opts.url, {
      // Fail fast so a Redis outage degrades requests instead of hanging them.
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
    });
    redis.on('error', (err) => app.log.warn({ err }, 'Redis connection error'));
    app.decorate('redis', redis);
    app.addHook('onClose', async () => {
      await redis.quit().catch(() => redis.disconnect());
    });
  },
  { name: 'redis' },
);
