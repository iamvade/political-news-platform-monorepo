import type { ArticleStatus } from '@news/shared/schemas';
import { renderHtml, type ContentDoc } from '@news/shared/content';
import type { App } from '../app';
import { articles, type TiptapDoc } from '../db/schema/index';

export const BODY: ContentDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Улсын Их Хурал хуралдлаа.' }] }],
};

export const EMPTY_BODY: ContentDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

let sequence = 0;

/** Inserts an article directly in the given status (timestamps set to satisfy the status CHECKs). */
export async function insertArticle(
  app: App,
  authorId: number,
  status: ArticleStatus = 'draft',
  overrides: Partial<typeof articles.$inferInsert> = {},
) {
  sequence += 1;
  const [row] = await app.db
    .insert(articles)
    .values({
      title: `Test article ${sequence}`,
      slug: `test-article-${sequence}`,
      bodyJson: BODY as TiptapDoc,
      bodyHtml: renderHtml(BODY),
      status,
      authorId,
      publishedAt: status === 'published' ? new Date('2026-01-01T00:00:00Z') : null,
      scheduledAt: status === 'scheduled' ? new Date(Date.now() + 60 * 60 * 1000) : null,
      ...overrides,
    })
    .returning();
  if (!row) throw new Error('insertArticle failed');
  return row;
}
