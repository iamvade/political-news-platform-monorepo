import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../../config/env';
import type { RevalidateJobData } from '../types';

export interface RevalidateDeps {
  env: Pick<Env, 'WEB_REVALIDATE_URL' | 'WEB_REVALIDATE_SECRET'>;
  log: FastifyBaseLogger;
  fetch?: typeof fetch;
}

/**
 * Cache tags for a job: an article's page plus the lists that show it (homepage, article lists), or the
 * explicit list. Must match the tags the web's data layer puts on its fetches (apps/web/src/lib/data.ts).
 */
export const revalidateTags = (data: RevalidateJobData): string[] =>
  'tags' in data ? data.tags : [`article:${data.articleId}`, 'homepage', 'articles'];

/** Asks the Next.js site to revalidate the given tags. Throws on failure so BullMQ retries. */
export async function processRevalidate(deps: RevalidateDeps, data: RevalidateJobData): Promise<'sent' | 'skipped'> {
  const { WEB_REVALIDATE_URL: url, WEB_REVALIDATE_SECRET: secret } = deps.env;
  const tags = revalidateTags(data);
  if (!url || !secret) {
    deps.log.info({ tags }, 'Revalidate skipped (WEB_REVALIDATE_URL not configured)');
    return 'skipped';
  }

  const res = await (deps.fetch ?? fetch)(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': secret },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Revalidate failed with HTTP ${res.status}`);
  return 'sent';
}
