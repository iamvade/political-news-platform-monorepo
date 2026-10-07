import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBullConnection, createBullJobs } from './queue';
import { QUEUES, scheduledPublishJobId, type Jobs } from './types';

/** Real BullMQ against the test Redis database (db 15), to prove scheduling and cancellation by job id. */
describe('createBullJobs (BullMQ)', () => {
  const redisUrl = process.env.REDIS_URL!;
  let jobs: Jobs;
  let connection: Redis;
  let scheduled: Queue;
  const effectQueues: Queue[] = [];

  beforeAll(() => {
    if (!redisUrl.endsWith('/15')) throw new Error(`Refusing to run against ${redisUrl}`);
    jobs = createBullJobs(redisUrl);
    connection = createBullConnection(redisUrl);
    scheduled = new Queue(QUEUES.scheduledPublish, { connection });
    for (const name of [QUEUES.revalidate, QUEUES.push, QUEUES.searchIndex]) {
      effectQueues.push(new Queue(name, { connection }));
    }
  });

  beforeEach(async () => {
    await connection.flushdb();
  });

  afterAll(async () => {
    await connection.flushdb();
    await jobs.close();
    await Promise.all([scheduled, ...effectQueues].map((q) => q.close()));
    await connection.quit();
  });

  it('schedulePublish creates a delayed job keyed by article id', async () => {
    const at = new Date(Date.now() + 30 * 60_000);

    await jobs.schedulePublish(42, at, 7);

    const job = await scheduled.getJob(scheduledPublishJobId(42));
    expect(await job?.getState()).toBe('delayed');
    expect(job?.data).toEqual({ articleId: 42, scheduledAt: at.toISOString(), scheduledBy: 7 });
    expect(job?.delay).toBeGreaterThan(29 * 60_000);
  });

  it('rescheduling replaces the job with the new time', async () => {
    await jobs.schedulePublish(42, new Date(Date.now() + 30 * 60_000), 7);
    const later = new Date(Date.now() + 120 * 60_000);

    await jobs.schedulePublish(42, later, 8);

    expect(await scheduled.getDelayedCount()).toBe(1);
    const job = await scheduled.getJob(scheduledPublishJobId(42));
    expect(job?.data).toMatchObject({ scheduledAt: later.toISOString(), scheduledBy: 8 });
    expect(job?.delay).toBeGreaterThan(119 * 60_000);
  });

  it('cancelScheduledPublish removes the job (and is a no-op when there is none)', async () => {
    await jobs.schedulePublish(42, new Date(Date.now() + 30 * 60_000), 7);

    await jobs.cancelScheduledPublish(42);
    await jobs.cancelScheduledPublish(42);

    expect(await scheduled.getJob(scheduledPublishJobId(42))).toBeUndefined();
    expect(await scheduled.getDelayedCount()).toBe(0);
  });

  it('enqueuePublished adds revalidate, push and search-index jobs; enqueueChanged skips push; enqueueHomepageChanged only revalidates', async () => {
    await jobs.enqueuePublished({ id: 5, isBreaking: true });
    await jobs.enqueueChanged(5);
    await jobs.enqueueHomepageChanged();

    const counts = await Promise.all(effectQueues.map((q) => q.getWaitingCount()));
    expect(Object.fromEntries(effectQueues.map((q, i) => [q.name, counts[i]]))).toEqual({
      [QUEUES.revalidate]: 3,
      [QUEUES.push]: 1,
      [QUEUES.searchIndex]: 2,
    });
  });
});
