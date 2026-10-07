import type { FastifyBaseLogger } from 'fastify';
import type { ArticleJobData } from '../types';

/**
 * PLACEHOLDER: search is not built yet (Postgres trigram + transliteration skeleton, PRD §5.3).
 * TODO: refresh the article's search document (title/lede/body text + Latin skeleton).
 */
export async function processSearchIndex(deps: { log: FastifyBaseLogger }, data: ArticleJobData): Promise<'skipped'> {
  deps.log.info({ articleId: data.articleId }, 'Search index refresh skipped (not implemented yet)');
  return 'skipped';
}
