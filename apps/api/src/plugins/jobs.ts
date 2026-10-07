import fp from 'fastify-plugin';
import { createBullJobs } from '../jobs/queue';
import type { Jobs } from '../jobs/types';

declare module 'fastify' {
  interface FastifyInstance {
    /** Enqueue background work. Call only after the DB transaction has committed. */
    jobs: Jobs;
  }
}

/** Decorates `app.jobs`. Pass `jobs` to inject a fake (tests); otherwise BullMQ on REDIS_URL is used. */
export const jobsPlugin = fp<{ jobs?: Jobs }>(
  async (app, opts) => {
    const jobs = opts.jobs ?? createBullJobs(app.env.REDIS_URL);
    app.decorate('jobs', jobs);
    app.addHook('onClose', async () => {
      if (!opts.jobs) await jobs.close();
    });
  },
  { name: 'jobs' },
);
