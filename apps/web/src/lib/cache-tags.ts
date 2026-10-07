/**
 * Cache tags on the data layer's fetches. The API's revalidate job sends the same names
 * (apps/api/src/lib/revalidate.ts, jobs/processors/revalidate.ts) to /api/revalidate.
 */
export const cacheTags = {
  homepage: 'homepage',
  articles: 'articles',
  people: 'people',
  parliament: 'parliament',
  article: (id: number) => `article:${id}`,
  person: (id: number) => `person:${id}`,
} as const;

/** What /api/revalidate accepts: `name` or `name:value` (lowercase, digits, dashes). */
export const CACHE_TAG_PATTERN = /^[a-z][a-z0-9-]*(?::[a-z0-9-]+)?$/;
