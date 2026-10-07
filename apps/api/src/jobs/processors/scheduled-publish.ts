import { and, desc, eq, isNull, lte } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db } from '../../db/client';
import { articleRevisions, articles } from '../../db/schema/index';
import { publishLocked } from '../../modules/articles/service';
import type { Jobs, ScheduledPublishJobData } from '../types';

export interface ProcessorDeps {
  db: Db;
  jobs: Jobs;
  log: FastifyBaseLogger;
}

/** BullMQ can fire a delayed job slightly early; treat anything within this window as due. */
const EARLY_TOLERANCE_MS = 5_000;

export type PublishOutcome = 'published' | 'skipped';

/**
 * Publishes an article if it is still scheduled and due. Idempotent: if the article was unpublished,
 * rescheduled (scheduled_at no longer matches `expectedScheduledAt`), published or deleted, it does nothing.
 */
export async function publishIfDue(
  deps: ProcessorDeps,
  articleId: number,
  opts: { expectedScheduledAt?: Date; actorId?: number; now?: Date },
): Promise<PublishOutcome> {
  const now = opts.now ?? new Date();

  const published = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(articles)
      .where(and(eq(articles.id, articleId), isNull(articles.deletedAt)))
      .for('update');
    if (!row || row.status !== 'scheduled' || !row.scheduledAt) return null;
    if (opts.expectedScheduledAt && row.scheduledAt.getTime() !== opts.expectedScheduledAt.getTime()) return null;
    if (row.scheduledAt.getTime() > now.getTime() + EARLY_TOLERANCE_MS) return null;

    // Attribute the publish to whoever scheduled it; fall back to the author.
    let actorId = opts.actorId;
    if (actorId === undefined) {
      const [lastSchedule] = await tx
        .select({ editorId: articleRevisions.editorId })
        .from(articleRevisions)
        .where(and(eq(articleRevisions.articleId, articleId), eq(articleRevisions.kind, 'schedule')))
        .orderBy(desc(articleRevisions.createdAt), desc(articleRevisions.id))
        .limit(1);
      actorId = lastSchedule?.editorId ?? row.authorId;
    }
    return publishLocked(tx, row, actorId, now);
  });

  if (!published) {
    deps.log.info({ articleId }, 'Scheduled publish skipped (not scheduled, rescheduled or not due)');
    return 'skipped';
  }
  deps.log.info({ articleId }, 'Scheduled article published');
  await deps.jobs.enqueuePublished(published);
  return 'published';
}

/** Processor for the delayed `publish` job created by Jobs.schedulePublish. */
export function processScheduledPublish(deps: ProcessorDeps, data: ScheduledPublishJobData): Promise<PublishOutcome> {
  return publishIfDue(deps, data.articleId, {
    expectedScheduledAt: new Date(data.scheduledAt),
    actorId: data.scheduledBy,
  });
}

/** Safety net (every minute): publishes overdue scheduled articles whose delayed job was lost. */
export async function sweepScheduled(deps: ProcessorDeps, now = new Date()): Promise<number> {
  const due = await deps.db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.status, 'scheduled'), lte(articles.scheduledAt, now), isNull(articles.deletedAt)));

  let published = 0;
  for (const { id } of due) {
    if ((await publishIfDue(deps, id, { now })) === 'published') published += 1;
  }
  if (published > 0) deps.log.warn({ published }, 'Sweep published overdue scheduled articles');
  return published;
}
