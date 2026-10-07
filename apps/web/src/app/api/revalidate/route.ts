import { createHash, timingSafeEqual } from 'node:crypto';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { CACHE_TAG_PATTERN } from '@/lib/cache-tags';
import { serverEnv } from '@/lib/env';

const bodySchema = z.object({
  tags: z.array(z.string().max(256).regex(CACHE_TAG_PATTERN)).min(1).max(50),
});

const error = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store' } });

/** Constant-time comparison of the shared secret (hashed first so lengths never leak). */
function secretMatches(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Called by the API's BullMQ revalidate job after a publish or data edit:
 * `POST { tags: ['article:42', 'homepage'] }` with header `x-revalidate-secret`.
 * Tags are marked stale ("max" profile): the next visit is served the old page while it regenerates.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv().WEB_REVALIDATE_SECRET;
  if (!secret) return error(503, 'REVALIDATE_DISABLED', 'WEB_REVALIDATE_SECRET is not configured');
  if (!secretMatches(request.headers.get('x-revalidate-secret') ?? '', secret)) {
    return error(401, 'UNAUTHORIZED', 'Invalid revalidation secret');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, 'VALIDATION_ERROR', 'Body must be JSON');
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return error(400, 'VALIDATION_ERROR', 'Expected { tags: string[] } with 1–50 valid tags');

  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) revalidateTag(tag, 'max');
  console.info('Revalidated cache tags', tags);
  return Response.json({ data: { revalidated: tags } }, { headers: { 'cache-control': 'no-store' } });
}
