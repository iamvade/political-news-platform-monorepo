import { Queue, Worker, type Job } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { markFailed, processMediaVariants } from './processors/media-variants';
import { processPush } from './processors/push';
import { processRevalidate } from './processors/revalidate';
import { processScheduledPublish, sweepScheduled } from './processors/scheduled-publish';
import { processSearchIndex } from './processors/search-index';
import { createBullConnection } from './queue';
import { MEDIA_VARIANT_ATTEMPTS, QUEUES, type ArticleJobData, type MediaJobData, type ScheduledPublishJobData } from './types';

const SWEEP_SCHEDULER_ID = 'sweep-scheduled';
const SWEEP_EVERY_MS = 60_000;

/**
 * Starts the BullMQ workers in this process and registers their shutdown on app close.
 * Call before `listen()` (hooks cannot be added after the app is ready).
 */
export async function registerWorkers(app: FastifyInstance): Promise<void> {
  const connection = createBullConnection(app.env.REDIS_URL);
  const deps = { db: app.db, jobs: app.jobs, log: app.log };

  const scheduledQueue = new Queue(QUEUES.scheduledPublish, { connection });
  await scheduledQueue.upsertJobScheduler(SWEEP_SCHEDULER_ID, { every: SWEEP_EVERY_MS }, { name: 'sweep' });

  const mediaWorker = new Worker(
    QUEUES.mediaVariants,
    (job: Job<MediaJobData>) => processMediaVariants({ db: app.db, storage: app.storage, log: app.log }, job.data),
    // sharp is CPU-heavy; keep it to one image at a time in the API process.
    { connection, concurrency: 1 },
  );
  // Out of retries (e.g. storage kept failing): surface it on the media row.
  mediaWorker.on('failed', (job, err) => {
    if (job && job.attemptsMade >= MEDIA_VARIANT_ATTEMPTS) {
      void markFailed(app.db, job.data.mediaId, `Processing failed after ${job.attemptsMade} attempts: ${err.message}`);
    }
  });

  const workers = [
    new Worker(
      QUEUES.scheduledPublish,
      (job: Job) =>
        job.name === 'sweep' ? sweepScheduled(deps) : processScheduledPublish(deps, job.data as ScheduledPublishJobData),
      { connection },
    ),
    new Worker(QUEUES.revalidate, (job: Job<ArticleJobData>) => processRevalidate({ env: app.env, log: app.log }, job.data), {
      connection,
    }),
    new Worker(QUEUES.push, (job: Job<ArticleJobData>) => processPush(deps, job.data), { connection }),
    new Worker(QUEUES.searchIndex, (job: Job<ArticleJobData>) => processSearchIndex(deps, job.data), { connection }),
    mediaWorker,
  ];
  for (const worker of workers) {
    worker.on('failed', (job, err) => app.log.error({ err, queue: worker.name, jobId: job?.id }, 'Job failed'));
  }
  app.log.info({ queues: Object.values(QUEUES) }, 'Workers started');

  app.addHook('onClose', async () => {
    await Promise.all(workers.map((worker) => worker.close()));
    await scheduledQueue.close();
    await connection.quit().catch(() => connection.disconnect());
  });
}
