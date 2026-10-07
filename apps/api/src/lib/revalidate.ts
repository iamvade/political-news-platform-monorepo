import type { AdminCorrection } from '@news/shared/schemas';
import type { FastifyInstance } from 'fastify';

/**
 * Web cache tags (apps/web/src/lib/data.ts tags its fetches with the same names). The revalidate job POSTs
 * them to the web's /api/revalidate.
 */
export const cacheTags = {
  homepage: 'homepage',
  articles: 'articles',
  /** Every person page (party names/colours, imports touching many people). */
  people: 'people',
  /** "Parliament this week" and bill data. */
  parliament: 'parliament',
  article: (id: number) => `article:${id}`,
  person: (id: number) => `person:${id}`,
} as const;

/** A person's page, or every person page when the record has no person (e.g. a party's promise). */
export const personOrPeople = (personId: number | null) => [personId ? cacheTags.person(personId) : cacheTags.people];

/** Corrections show on the page of what they correct. */
export function correctionTags(correction: Pick<AdminCorrection, 'entityType' | 'entityId'>): string[] {
  switch (correction.entityType) {
    case 'article':
      return [cacheTags.article(correction.entityId)];
    case 'person':
      return [cacheTags.person(correction.entityId)];
    case 'bill':
    case 'vote':
      return [cacheTags.parliament];
    default:
      return [cacheTags.people];
  }
}

/**
 * Enqueue web revalidation for a change that has already committed. Never throws: the data is saved, and
 * the pages' time-based revalidation is the fallback if the queue is down.
 */
export async function revalidateAfterCommit(app: FastifyInstance, tags: string[]): Promise<void> {
  if (tags.length === 0) return;
  try {
    await app.jobs.enqueueRevalidate(tags);
  } catch (err) {
    app.log.error({ err, tags }, 'Failed to enqueue web revalidation');
  }
}
