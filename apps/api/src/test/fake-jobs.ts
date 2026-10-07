import type { Jobs } from '../jobs/types';

export type JobCall =
  | { type: 'schedulePublish'; articleId: number; at: Date; scheduledBy: number }
  | { type: 'cancelScheduledPublish'; articleId: number }
  | { type: 'enqueuePublished'; articleId: number; isBreaking: boolean }
  | { type: 'enqueueChanged'; articleId: number }
  | { type: 'enqueueMediaVariants'; mediaId: number };

export interface FakeJobs extends Jobs {
  calls: JobCall[];
  reset(): void;
}

/** Records job calls instead of talking to Redis. */
export function createFakeJobs(): FakeJobs {
  const calls: JobCall[] = [];
  return {
    calls,
    reset: () => {
      calls.length = 0;
    },
    async schedulePublish(articleId, at, scheduledBy) {
      calls.push({ type: 'schedulePublish', articleId, at, scheduledBy });
    },
    async cancelScheduledPublish(articleId) {
      calls.push({ type: 'cancelScheduledPublish', articleId });
    },
    async enqueuePublished(article) {
      calls.push({ type: 'enqueuePublished', articleId: article.id, isBreaking: article.isBreaking });
    },
    async enqueueChanged(articleId) {
      calls.push({ type: 'enqueueChanged', articleId });
    },
    async enqueueMediaVariants(mediaId) {
      calls.push({ type: 'enqueueMediaVariants', mediaId });
    },
    async close() {},
  };
}
