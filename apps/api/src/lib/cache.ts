import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Cache-Control presets for public routes. Cloudflare uses `s-maxage` as the edge TTL; browsers use `max-age`.
 * `stale-if-error` keeps pages readable from the edge if the origin is down (PRD §11.2).
 */
export const CACHE_PRESETS = {
  /** Article lists and pages: short, breaking news must appear quickly. */
  news: 'public, max-age=30, s-maxage=60, stale-while-revalidate=300, stale-if-error=86400',
  /** Profiles, organizations, bills: change rarely. */
  profile: 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600, stale-if-error=86400',
} as const;
export type CachePreset = keyof typeof CACHE_PRESETS;

const NOT_FOUND = 'public, max-age=30, s-maxage=60';
const GONE = 'public, max-age=300, s-maxage=3600';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** Public routes: which Cache-Control preset to send on success (default `news`). */
    cache?: CachePreset;
  }
}

export function cacheControlFor(statusCode: number, preset: CachePreset = 'news'): string {
  if (statusCode >= 200 && statusCode < 300) return CACHE_PRESETS[preset];
  if (statusCode === 404) return NOT_FOUND;
  if (statusCode === 410) return GONE;
  return 'no-store';
}

/** onSend hook for the /v1/public scope. */
export async function publicCacheHook(request: FastifyRequest, reply: FastifyReply, payload: unknown) {
  reply.header('cache-control', cacheControlFor(reply.statusCode, request.routeOptions.config.cache));
  return payload;
}
