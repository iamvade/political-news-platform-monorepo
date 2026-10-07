import {
  ErrorCode,
  type AdminHomepage,
  type AuthUser,
  type HomepageVersion,
  type HomepageZones,
  type PaginationQuery,
  type SaveHomepageBody,
} from '@news/shared/schemas';
import type { FastifyBaseLogger } from 'fastify';
import { count, desc, inArray, sql } from 'drizzle-orm';
import type { Db, Tx } from '../../db/client';
import { articles, categories, homepageLayouts } from '../../db/schema/index';
import type { Jobs } from '../../jobs/types';
import { audit } from '../../lib/audit';
import { iso } from '../../lib/crud';
import { AppError } from '../../lib/errors';
import { toArticleSummary } from '../articles/service';

export interface HomepageDeps {
  db: Db;
  jobs: Jobs;
  log: FastifyBaseLogger;
}

type LayoutRow = typeof homepageLayouts.$inferSelect;

export const EMPTY_ZONES: HomepageZones = { heroArticleId: null, featuredArticleIds: [], sectionCategoryIds: [] };

/** Serializes saves so two editors cannot both pass the version check. */
const SAVE_LOCK = 4_120_001;

/** The live layout: the newest version. */
export async function latestLayout(db: Db | Tx): Promise<LayoutRow | undefined> {
  const [row] = await db.select().from(homepageLayouts).orderBy(desc(homepageLayouts.id)).limit(1);
  return row;
}

const pinnedArticleIds = (zones: HomepageZones) => [...(zones.heroArticleId ? [zones.heroArticleId] : []), ...zones.featuredArticleIds];

async function toAdminHomepage(db: Db, row: LayoutRow | undefined): Promise<AdminHomepage> {
  const zones = row?.zones ?? EMPTY_ZONES;
  const ids = pinnedArticleIds(zones);
  const articleRows = ids.length ? await db.select().from(articles).where(inArray(articles.id, ids)) : [];
  const categoryRows = zones.sectionCategoryIds.length
    ? await db.select({ id: categories.id, nameMn: categories.nameMn }).from(categories).where(inArray(categories.id, zones.sectionCategoryIds))
    : [];
  return {
    version: row?.id ?? null,
    zones,
    articles: articleRows.map(toArticleSummary),
    categories: categoryRows,
    createdAt: row ? iso(row.createdAt) : null,
    createdBy: row?.createdBy ?? null,
  };
}

export async function getHomepage(db: Db): Promise<AdminHomepage> {
  return toAdminHomepage(db, await latestLayout(db));
}

/** Pinned articles must exist and be published; sections must be existing categories. */
async function assertZonesUsable(tx: Tx, zones: HomepageZones): Promise<void> {
  const ids = pinnedArticleIds(zones);
  if (ids.length) {
    const rows = await tx
      .select({ id: articles.id, status: articles.status, deletedAt: articles.deletedAt })
      .from(articles)
      .where(inArray(articles.id, ids));
    const missing = ids.filter((id) => !rows.some((row) => row.id === id && row.deletedAt === null));
    if (missing.length) throw new AppError(400, ErrorCode.REFERENCE_NOT_FOUND, `Unknown article id(s): ${missing.join(', ')}`);
    const unpublished = rows.filter((row) => row.status !== 'published').map((row) => row.id);
    if (unpublished.length) {
      throw new AppError(400, ErrorCode.ARTICLE_NOT_PUBLISHED, `Only published articles can be pinned: ${unpublished.join(', ')}`);
    }
  }
  if (zones.sectionCategoryIds.length) {
    const rows = await tx.select({ id: categories.id }).from(categories).where(inArray(categories.id, zones.sectionCategoryIds));
    const missing = zones.sectionCategoryIds.filter((id) => !rows.some((row) => row.id === id));
    if (missing.length) throw new AppError(400, ErrorCode.REFERENCE_NOT_FOUND, `Unknown category id(s): ${missing.join(', ')}`);
  }
}

/**
 * Saves a new version, which goes live immediately (an explicit editor action). `expectedVersion` must be the
 * current live version, otherwise someone else saved in between → 409 EDIT_CONFLICT.
 */
export async function saveHomepage(deps: HomepageDeps, user: AuthUser, body: SaveHomepageBody): Promise<AdminHomepage> {
  const row = await deps.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${SAVE_LOCK})`);
    const current = await latestLayout(tx);
    if ((current?.id ?? null) !== body.expectedVersion) {
      throw new AppError(409, ErrorCode.EDIT_CONFLICT, 'The homepage was changed by someone else; reload before saving');
    }
    await assertZonesUsable(tx, body.zones);
    const [inserted] = await tx.insert(homepageLayouts).values({ zones: body.zones, createdBy: user.id }).returning();
    await audit(tx, {
      actorId: user.id,
      action: 'create',
      entityType: 'homepage_layout',
      entityId: inserted!.id,
      diff: { before: current?.zones ?? null, after: body.zones },
    });
    return inserted!;
  });

  try {
    await deps.jobs.enqueueRevalidate(['homepage']);
  } catch (err) {
    deps.log.error({ err }, 'Failed to enqueue homepage revalidation');
  }
  return toAdminHomepage(deps.db, row);
}

/** Saved versions, newest first (load one in the editor and save it again to revert). */
export async function listVersions(db: Db, query: PaginationQuery): Promise<{ items: HomepageVersion[]; total: number }> {
  const [total] = await db.select({ n: count() }).from(homepageLayouts);
  const rows = await db
    .select()
    .from(homepageLayouts)
    .orderBy(desc(homepageLayouts.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return {
    items: rows.map((row) => ({ version: row.id, zones: row.zones, createdAt: iso(row.createdAt), createdBy: row.createdBy })),
    total: total?.n ?? 0,
  };
}
