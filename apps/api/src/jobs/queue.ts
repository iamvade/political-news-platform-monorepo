import { Queue, type JobsOptions } from 'bullmq';
import { Redis } from 'ioredis';
import {
  MEDIA_VARIANT_ATTEMPTS,
  QUEUES,
  scheduledPublishJobId,
  type ArticleJobData,
  type Jobs,
  type MediaJobData,
  type RevalidateJobData,
  type ScheduledPublishJobData,
} from './types';

/** Retries for side-effect jobs (revalidate, push, search index). */
const EFFECT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: true,
  removeOnFail: 1_000,
};

/** BullMQ needs its own connection with maxRetriesPerRequest: null (the app's Redis client fails fast). */
export function createBullConnection(redisUrl: string): Redis {
  return new Redis(redisUrl, { maxRetriesPerRequest: null });
}

export function createBullJobs(redisUrl: string): Jobs {
  const connection = createBullConnection(redisUrl);
  const scheduledPublish = new Queue<ScheduledPublishJobData>(QUEUES.scheduledPublish, { connection });
  const revalidate = new Queue<RevalidateJobData>(QUEUES.revalidate, { connection });
  const push = new Queue<ArticleJobData>(QUEUES.push, { connection });
  const searchIndex = new Queue<ArticleJobData>(QUEUES.searchIndex, { connection });
  const mediaVariants = new Queue<MediaJobData>(QUEUES.mediaVariants, { connection });

  return {
    async schedulePublish(articleId, at, scheduledBy) {
      const jobId = scheduledPublishJobId(articleId);
      await scheduledPublish.remove(jobId);
      await scheduledPublish.add(
        'publish',
        { articleId, scheduledAt: at.toISOString(), scheduledBy },
        {
          jobId,
          delay: Math.max(0, at.getTime() - Date.now()),
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: true,
          removeOnFail: 1_000,
        },
      );
    },

    async cancelScheduledPublish(articleId) {
      await scheduledPublish.remove(scheduledPublishJobId(articleId));
    },

    async enqueuePublished(article) {
      const data = { articleId: article.id, isBreaking: article.isBreaking };
      await Promise.all([
        revalidate.add('article', data, EFFECT_JOB_OPTIONS),
        push.add('article', data, EFFECT_JOB_OPTIONS),
        searchIndex.add('article', data, EFFECT_JOB_OPTIONS),
      ]);
    },

    async enqueueChanged(articleId) {
      const data = { articleId };
      await Promise.all([
        revalidate.add('article', data, EFFECT_JOB_OPTIONS),
        searchIndex.add('article', data, EFFECT_JOB_OPTIONS),
      ]);
    },

    async enqueueHomepageChanged() {
      await revalidate.add('tags', { tags: ['home'] }, EFFECT_JOB_OPTIONS);
    },

    async enqueueMediaVariants(mediaId) {
      await mediaVariants.add(
        'variants',
        { mediaId },
        {
          // One job per media at a time; a duplicate confirm cannot queue twice.
          jobId: `media-${mediaId}`,
          attempts: MEDIA_VARIANT_ATTEMPTS,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: true,
          removeOnFail: 1_000,
        },
      );
    },

    async close() {
      await Promise.all([scheduledPublish.close(), revalidate.close(), push.close(), searchIndex.close(), mediaVariants.close()]);
      await connection.quit().catch(() => connection.disconnect());
    },
  };
}
