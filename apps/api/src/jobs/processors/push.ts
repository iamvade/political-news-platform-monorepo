import type { FastifyBaseLogger } from 'fastify';
import type { ArticleJobData } from '../types';

/**
 * PLACEHOLDER: push notifications are not built yet (Expo push + device registry, PRD P1).
 * The job is enqueued on every publish so the pipeline exists; this processor only logs.
 * TODO: send to subscribed devices (breaking news / followed people).
 */
export async function processPush(deps: { log: FastifyBaseLogger }, data: ArticleJobData): Promise<'skipped'> {
  deps.log.info({ articleId: data.articleId, isBreaking: data.isBreaking }, 'Push skipped (not implemented yet)');
  return 'skipped';
}
