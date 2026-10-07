import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../../config/env';
import type { ArticleJobData } from '../types';

export interface RevalidateDeps {
  env: Pick<Env, 'WEB_REVALIDATE_URL' | 'WEB_REVALIDATE_SECRET'>;
  log: FastifyBaseLogger;
  fetch?: typeof fetch;
}

/** Asks the Next.js site to revalidate the article and the home page. Throws on failure so BullMQ retries. */
export async function processRevalidate(deps: RevalidateDeps, data: ArticleJobData): Promise<'sent' | 'skipped'> {
  const { WEB_REVALIDATE_URL: url, WEB_REVALIDATE_SECRET: secret } = deps.env;
  if (!url || !secret) {
    deps.log.info({ articleId: data.articleId }, 'Revalidate skipped (WEB_REVALIDATE_URL not configured)');
    return 'skipped';
  }

  const res = await (deps.fetch ?? fetch)(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags: [`article:${data.articleId}`, 'home'] }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Revalidate failed with HTTP ${res.status}`);
  return 'sent';
}
