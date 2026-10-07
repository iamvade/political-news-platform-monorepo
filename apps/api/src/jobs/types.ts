/** Background work triggered by the API. Implemented on BullMQ (jobs/queue.ts); tests inject a fake. */
export interface Jobs {
  /** Replaces any existing scheduled-publish job for the article. */
  schedulePublish(articleId: number, at: Date, scheduledBy: number): Promise<void>;
  cancelScheduledPublish(articleId: number): Promise<void>;
  /** After an article goes live: revalidate pages, push notification, search index. */
  enqueuePublished(article: { id: number; isBreaking: boolean }): Promise<void>;
  /** After a published article changes or is unpublished: revalidate pages, search index. */
  enqueueChanged(articleId: number): Promise<void>;
  /** After a homepage layout is saved: revalidate the home page. */
  enqueueHomepageChanged(): Promise<void>;
  /** After an upload is confirmed: generate WebP variants. */
  enqueueMediaVariants(mediaId: number): Promise<void>;
  close(): Promise<void>;
}

export const QUEUES = {
  scheduledPublish: 'scheduled-publish',
  revalidate: 'revalidate',
  push: 'push',
  searchIndex: 'search-index',
  mediaVariants: 'media-variants',
} as const;

export interface ScheduledPublishJobData {
  articleId: number;
  /** ISO time the job was scheduled for; a mismatch with the DB means the job is stale. */
  scheduledAt: string;
  scheduledBy: number;
}

export interface ArticleJobData {
  articleId: number;
  isBreaking?: boolean;
}

/** Revalidate jobs: an article (its page + home) or explicit cache tags. */
export type RevalidateJobData = ArticleJobData | { tags: string[] };

export const scheduledPublishJobId = (articleId: number) => `article-${articleId}`;

export interface MediaJobData {
  mediaId: number;
}

/** Attempts for media-variants; after the last one the row is marked failed. */
export const MEDIA_VARIANT_ATTEMPTS = 3;

