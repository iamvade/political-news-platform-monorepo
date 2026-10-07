import { contentDocSchema, hasText, type ContentDoc } from '@news/shared/content';
import {
  ErrorCode,
  type Article,
  type ArticleEdit,
  type ArticleListQuery,
  type ArticleRevision,
  type ArticleSummary,
  type AuthUser,
  type CreateArticleBody,
  type RevisionKind,
  type UpdateArticleBody,
} from '@news/shared/schemas';
import { slugify } from '@news/shared/translit';
import { and, count, desc, eq, ilike, isNull, type SQL } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Db, Tx } from '../../db/client';
import { articleRevisions, articles, corrections, type TiptapDoc } from '../../db/schema/index';
import type { Jobs } from '../../jobs/types';
import { AppError } from '../../lib/errors';
import { toSafeHtml } from '../../lib/html';
import { assertUsableCover } from '../media/service';
import { LINK_FIELDS, loadLinks, replaceLinks, type ArticleLinks } from './links';
import * as slugs from '../../lib/slugs';
import { can, canTransition, TRANSITIONS, type ArticleAction, type TransitionAction } from './policy';

export type ArticleRow = typeof articles.$inferSelect;
type RevisionRow = typeof articleRevisions.$inferSelect;

export interface ArticleDeps {
  db: Db;
  jobs: Jobs;
  log: FastifyBaseLogger;
}

/** Fields restored from a revision and editable via PATCH. */
const CONTENT_FIELDS = ['title', 'slug', 'lede', 'bodyJson', 'categoryId', 'coverMediaId', 'isBreaking'] as const;

// ---------------------------------------------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------------------------------------------

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toArticleSummary(row: ArticleRow): ArticleSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    authorId: row.authorId,
    categoryId: row.categoryId,
    isBreaking: row.isBreaking,
    publishedAt: iso(row.publishedAt),
    scheduledAt: iso(row.scheduledAt),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toArticle(row: ArticleRow, links: ArticleLinks): Article {
  return {
    ...toArticleSummary(row),
    lede: row.lede,
    bodyJson: row.bodyJson as ContentDoc,
    bodyHtml: row.bodyHtml,
    coverMediaId: row.coverMediaId,
    createdAt: row.createdAt.toISOString(),
    ...links,
  };
}

/** Full article DTO including linked tags/persons/organizations/bills. */
async function articleDto(db: Db | Tx, row: ArticleRow): Promise<Article> {
  const links = await loadLinks(db, [row.id]);
  return toArticle(row, links.get(row.id)!);
}

function toRevision(row: RevisionRow): ArticleRevision {
  return {
    id: row.id,
    articleId: row.articleId,
    kind: row.kind,
    editorId: row.editorId,
    createdAt: row.createdAt.toISOString(),
    snapshot: row.snapshot,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------------------------

function assertCan(user: AuthUser, action: ArticleAction, article?: ArticleRow): void {
  if (!can(user, action, article)) {
    throw new AppError(403, ErrorCode.FORBIDDEN, `Not allowed to ${action} this article`);
  }
}

function assertTransition(action: TransitionAction, row: ArticleRow): void {
  if (!canTransition(action, row.status)) {
    throw new AppError(
      409,
      ErrorCode.INVALID_STATUS_TRANSITION,
      `Cannot ${action} an article with status "${row.status}"`,
    );
  }
}

function notFound(): AppError {
  return new AppError(404, ErrorCode.ARTICLE_NOT_FOUND, 'Article not found');
}

function snapshotOf(row: ArticleRow, links: ArticleLinks, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...links,
    title: row.title,
    slug: row.slug,
    lede: row.lede,
    bodyJson: row.bodyJson,
    categoryId: row.categoryId,
    coverMediaId: row.coverMediaId,
    isBreaking: row.isBreaking,
    status: row.status,
    publishedAt: iso(row.publishedAt),
    scheduledAt: iso(row.scheduledAt),
    ...extra,
  };
}

async function writeRevision(
  tx: Tx,
  row: ArticleRow,
  kind: RevisionKind,
  editorId: number,
  extra?: Record<string, unknown>,
): Promise<void> {
  const links = (await loadLinks(tx, [row.id])).get(row.id)!;
  await tx.insert(articleRevisions).values({ articleId: row.id, kind, editorId, snapshot: snapshotOf(row, links, extra) });
}

/** Autosaves by the same editor within this window update one revision instead of adding rows (PRD §9.4). */
const AUTOSAVE_COALESCE_MS = 5 * 60 * 1000;

async function writeAutosaveRevision(tx: Tx, row: ArticleRow, editorId: number): Promise<void> {
  const [latest] = await tx
    .select()
    .from(articleRevisions)
    .where(eq(articleRevisions.articleId, row.id))
    .orderBy(desc(articleRevisions.createdAt), desc(articleRevisions.id))
    .limit(1);
  const coalesce =
    latest?.kind === 'autosave' && latest.editorId === editorId && Date.now() - latest.createdAt.getTime() < AUTOSAVE_COALESCE_MS;
  if (!coalesce) return writeRevision(tx, row, 'autosave', editorId);
  const links = (await loadLinks(tx, [row.id])).get(row.id)!;
  await tx.update(articleRevisions).set({ snapshot: snapshotOf(row, links) }).where(eq(articleRevisions.id, latest.id));
}

async function lockArticle(tx: Tx, id: number): Promise<ArticleRow> {
  const [row] = await tx
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
    .for('update');
  if (!row) throw notFound();
  return row;
}

const ARTICLE_SLUGS = { table: articles, id: articles.id, slug: articles.slug };
const slugExists = (db: Db | Tx, slug: string, exceptId?: number) => slugs.slugExists(db, ARTICLE_SLUGS, slug, exceptId);
const uniqueSlug = (db: Db | Tx, base: string) => slugs.uniqueSlug(db, ARTICLE_SLUGS, base);

function isSlugConflict(err: unknown): boolean {
  const cause = (err as { cause?: { code?: string; constraint_name?: string } }).cause;
  return cause?.code === '23505' && cause.constraint_name === 'articles_slug_unique';
}

function slugTaken(slug: string): AppError {
  return new AppError(409, ErrorCode.SLUG_TAKEN, `Slug "${slug}" is already used by another article`);
}

/** Run a post-commit side effect. Failures are logged, not thrown: the DB change already happened. */
async function afterCommit(deps: ArticleDeps, label: string, effect: () => Promise<void>): Promise<void> {
  try {
    await effect();
  } catch (err) {
    deps.log.error({ err, effect: label }, 'Failed to enqueue article job');
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

// ---------------------------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------------------------

export async function listArticles(
  deps: ArticleDeps,
  user: AuthUser,
  query: ArticleListQuery,
): Promise<{ items: ArticleSummary[]; total: number }> {
  assertCan(user, 'read');
  const conditions: SQL[] = [isNull(articles.deletedAt)];
  if (query.status) conditions.push(eq(articles.status, query.status));
  if (query.authorId) conditions.push(eq(articles.authorId, query.authorId));
  if (query.categoryId) conditions.push(eq(articles.categoryId, query.categoryId));
  if (query.search) conditions.push(ilike(articles.title, `%${escapeLike(query.search)}%`));
  const where = and(...conditions);

  const [totalRow] = await deps.db.select({ n: count() }).from(articles).where(where);
  const rows = await deps.db
    .select()
    .from(articles)
    .where(where)
    .orderBy(desc(articles.updatedAt), desc(articles.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  return { items: rows.map(toArticleSummary), total: totalRow?.n ?? 0 };
}

export async function getArticle(deps: ArticleDeps, user: AuthUser, id: number): Promise<Article> {
  assertCan(user, 'read');
  const [row] = await deps.db
    .select()
    .from(articles)
    .where(and(eq(articles.id, id), isNull(articles.deletedAt)))
    .limit(1);
  if (!row) throw notFound();
  return articleDto(deps.db, row);
}

export async function listRevisions(
  deps: ArticleDeps,
  user: AuthUser,
  id: number,
  page: { page: number; pageSize: number },
): Promise<{ items: ArticleRevision[]; total: number }> {
  await getArticle(deps, user, id);
  const where = eq(articleRevisions.articleId, id);
  const [totalRow] = await deps.db.select({ n: count() }).from(articleRevisions).where(where);
  const rows = await deps.db
    .select()
    .from(articleRevisions)
    .where(where)
    .orderBy(desc(articleRevisions.createdAt), desc(articleRevisions.id))
    .limit(page.pageSize)
    .offset((page.page - 1) * page.pageSize);
  return { items: rows.map(toRevision), total: totalRow?.n ?? 0 };
}

// ---------------------------------------------------------------------------------------------------------------
// Create / update / restore
// ---------------------------------------------------------------------------------------------------------------

export async function createArticle(deps: ArticleDeps, user: AuthUser, body: CreateArticleBody): Promise<Article> {
  assertCan(user, 'create');
  try {
    const row = await deps.db.transaction(async (tx) => {
      let slug: string;
      if (body.slug) {
        if (await slugExists(tx, body.slug)) throw slugTaken(body.slug);
        slug = body.slug;
      } else {
        slug = await uniqueSlug(tx, slugify(body.title));
      }

      if (body.coverMediaId) await assertUsableCover(tx, body.coverMediaId);

      const [inserted] = await tx
        .insert(articles)
        .values({
          title: body.title,
          slug,
          lede: body.lede ?? null,
          bodyJson: body.bodyJson as TiptapDoc,
          bodyHtml: toSafeHtml(body.bodyJson),
          status: 'draft',
          authorId: user.id,
          categoryId: body.categoryId ?? null,
          coverMediaId: body.coverMediaId ?? null,
          isBreaking: body.isBreaking ?? false,
        })
        .returning();
      if (!inserted) throw new Error('Article insert failed');
      await replaceLinks(tx, inserted.id, pickLinks(body));
      await writeRevision(tx, inserted, 'create', user.id);
      return inserted;
    });
    return articleDto(deps.db, row);
  } catch (err) {
    if (isSlugConflict(err)) throw slugTaken(body.slug ?? '');
    throw err;
  }
}

async function applyUpdate(
  deps: ArticleDeps,
  user: AuthUser,
  id: number,
  changes: Omit<UpdateArticleBody, 'edit'>,
  edit: ArticleEdit | undefined,
  kind: 'update' | 'restore' | 'autosave',
  extra?: Record<string, unknown>,
): Promise<Article> {
  const hasChanges = [...CONTENT_FIELDS, ...LINK_FIELDS].some((field) => changes[field] !== undefined);
  if (!hasChanges) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Nothing to update');

  try {
    const { row, wasPublished } = await deps.db.transaction(async (tx) => {
      const current = await lockArticle(tx, id);
      assertCan(user, 'update', current);

      if (changes.expectedUpdatedAt && new Date(changes.expectedUpdatedAt).getTime() !== current.updatedAt.getTime()) {
        throw new AppError(409, ErrorCode.EDIT_CONFLICT, 'The article was changed by someone else; reload before saving');
      }
      if (kind === 'autosave' && current.status !== 'draft' && current.status !== 'in_review') {
        throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Autosave is only available for drafts and articles in review');
      }

      const wasPublished = current.status === 'published';
      if (wasPublished) {
        if (!edit) {
          throw new AppError(
            400,
            ErrorCode.CORRECTION_REQUIRED,
            'Edits to a published article must declare edit.type ("minor" or "substantive" with a correction)',
          );
        }
        if (edit.type === 'substantive') {
          await tx.insert(corrections).values({
            entityType: 'article',
            entityId: current.id,
            date: new Date().toISOString().slice(0, 10),
            description: edit.correction.description,
            reason: edit.correction.reason,
            createdBy: user.id,
          });
        }
      }

      if (changes.coverMediaId && changes.coverMediaId !== current.coverMediaId) {
        await assertUsableCover(tx, changes.coverMediaId);
      }

      if (changes.slug !== undefined && changes.slug !== current.slug && (await slugExists(tx, changes.slug, id))) {
        throw slugTaken(changes.slug);
      }

      const [updated] = await tx
        .update(articles)
        .set({
          title: changes.title,
          slug: changes.slug,
          lede: changes.lede,
          ...(changes.bodyJson !== undefined && {
            bodyJson: changes.bodyJson as TiptapDoc,
            bodyHtml: toSafeHtml(changes.bodyJson),
          }),
          categoryId: changes.categoryId,
          coverMediaId: changes.coverMediaId,
          isBreaking: changes.isBreaking,
          // Explicit so a links-only change still bumps updated_at (the edit-conflict token).
          updatedAt: new Date(),
        })
        .where(eq(articles.id, id))
        .returning();
      if (!updated) throw notFound();
      await replaceLinks(tx, id, pickLinks(changes));

      if (kind === 'autosave') {
        await writeAutosaveRevision(tx, updated, user.id);
      } else {
        await writeRevision(tx, updated, kind, user.id, {
          ...extra,
          ...(wasPublished && edit && { editType: edit.type }),
        });
      }
      return { row: updated, wasPublished };
    });

    if (wasPublished) await afterCommit(deps, 'enqueueChanged', () => deps.jobs.enqueueChanged(row.id));
    return articleDto(deps.db, row);
  } catch (err) {
    if (isSlugConflict(err)) throw slugTaken(changes.slug ?? '');
    throw err;
  }
}

export function updateArticle(deps: ArticleDeps, user: AuthUser, id: number, body: UpdateArticleBody) {
  const { edit, autosave, ...changes } = body;
  return applyUpdate(deps, user, id, changes, edit, autosave ? 'autosave' : 'update');
}

function pickLinks(body: Partial<ArticleLinks>): Partial<ArticleLinks> {
  return Object.fromEntries(LINK_FIELDS.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
}

const idList = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((v) => Number.isInteger(v)) ? (value as number[]) : undefined;

export async function restoreRevision(
  deps: ArticleDeps,
  user: AuthUser,
  id: number,
  revisionId: number,
  edit: ArticleEdit | undefined,
): Promise<Article> {
  const [revision] = await deps.db
    .select()
    .from(articleRevisions)
    .where(and(eq(articleRevisions.id, revisionId), eq(articleRevisions.articleId, id)))
    .limit(1);
  if (!revision) throw new AppError(404, ErrorCode.REVISION_NOT_FOUND, 'Revision not found');

  const snap = revision.snapshot;
  const body = contentDocSchema.safeParse(snap.bodyJson);
  if (!body.success) {
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'Revision body no longer passes content validation');
  }

  // Older snapshots may lack some fields; only restore what the snapshot has. Status is never restored.
  const changes: Omit<UpdateArticleBody, 'edit'> = {
    title: typeof snap.title === 'string' ? snap.title : undefined,
    slug: typeof snap.slug === 'string' ? snap.slug : undefined,
    lede: typeof snap.lede === 'string' || snap.lede === null ? (snap.lede as string | null) : undefined,
    bodyJson: body.data,
    categoryId: typeof snap.categoryId === 'number' || snap.categoryId === null ? (snap.categoryId as number | null) : undefined,
    coverMediaId:
      typeof snap.coverMediaId === 'number' || snap.coverMediaId === null ? (snap.coverMediaId as number | null) : undefined,
    isBreaking: typeof snap.isBreaking === 'boolean' ? snap.isBreaking : undefined,
    tagIds: idList(snap.tagIds),
    personIds: idList(snap.personIds),
    organizationIds: idList(snap.organizationIds),
    billIds: idList(snap.billIds),
  };
  return applyUpdate(deps, user, id, changes, edit, 'restore', { restoredFrom: revisionId });
}

// ---------------------------------------------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------------------------------------------

function assertPublishable(row: ArticleRow): void {
  if (!hasText(row.bodyJson as ContentDoc)) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Cannot publish or schedule an article with an empty body');
  }
}

/**
 * Publishes a locked row inside the caller's transaction. Shared by the publish route and the scheduled-publish
 * job, so both write the same revision and timestamps.
 */
export async function publishLocked(tx: Tx, row: ArticleRow, editorId: number, now = new Date()): Promise<ArticleRow> {
  const [updated] = await tx
    .update(articles)
    .set({ status: 'published', publishedAt: row.publishedAt ?? now, scheduledAt: null })
    .where(eq(articles.id, row.id))
    .returning();
  if (!updated) throw notFound();
  await writeRevision(tx, updated, 'publish', editorId);
  return updated;
}

async function transition(
  deps: ArticleDeps,
  user: AuthUser,
  id: number,
  action: TransitionAction,
  apply: (tx: Tx, row: ArticleRow) => Promise<ArticleRow>,
): Promise<{ before: ArticleRow; after: ArticleRow }> {
  return deps.db.transaction(async (tx) => {
    const before = await lockArticle(tx, id);
    assertCan(user, action, before);
    assertTransition(action, before);
    const after = await apply(tx, before);
    return { before, after };
  });
}

async function setStatus(
  tx: Tx,
  row: ArticleRow,
  values: Partial<Pick<ArticleRow, 'status' | 'scheduledAt'>>,
  kind: RevisionKind,
  editorId: number,
  extra?: Record<string, unknown>,
): Promise<ArticleRow> {
  const [updated] = await tx.update(articles).set(values).where(eq(articles.id, row.id)).returning();
  if (!updated) throw notFound();
  await writeRevision(tx, updated, kind, editorId, extra);
  return updated;
}

export async function submitArticle(deps: ArticleDeps, user: AuthUser, id: number): Promise<Article> {
  const { after } = await transition(deps, user, id, 'submit', (tx, row) =>
    setStatus(tx, row, { status: TRANSITIONS.submit.to }, 'submit', user.id),
  );
  return articleDto(deps.db, after);
}

export async function returnToDraft(deps: ArticleDeps, user: AuthUser, id: number, note?: string): Promise<Article> {
  const { after } = await transition(deps, user, id, 'returnToDraft', (tx, row) =>
    setStatus(tx, row, { status: TRANSITIONS.returnToDraft.to }, 'return_to_draft', user.id, note ? { note } : undefined),
  );
  return articleDto(deps.db, after);
}

export async function publishArticle(deps: ArticleDeps, user: AuthUser, id: number): Promise<Article> {
  const { before, after } = await transition(deps, user, id, 'publish', (tx, row) => {
    assertPublishable(row);
    return publishLocked(tx, row, user.id);
  });
  if (before.status === 'scheduled') {
    await afterCommit(deps, 'cancelScheduledPublish', () => deps.jobs.cancelScheduledPublish(id));
  }
  await afterCommit(deps, 'enqueuePublished', () => deps.jobs.enqueuePublished(after));
  return articleDto(deps.db, after);
}

export async function scheduleArticle(deps: ArticleDeps, user: AuthUser, id: number, at: Date): Promise<Article> {
  if (at.getTime() <= Date.now()) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'scheduledAt must be in the future');
  }
  const { after } = await transition(deps, user, id, 'schedule', (tx, row) => {
    assertPublishable(row);
    return setStatus(tx, row, { status: TRANSITIONS.schedule.to, scheduledAt: at }, 'schedule', user.id);
  });
  // Replaces any existing job, so rescheduling cancels the old one.
  await afterCommit(deps, 'schedulePublish', () => deps.jobs.schedulePublish(id, at, user.id));
  return articleDto(deps.db, after);
}

export async function unpublishArticle(deps: ArticleDeps, user: AuthUser, id: number): Promise<Article> {
  const { before, after } = await transition(deps, user, id, 'unpublish', (tx, row) =>
    setStatus(tx, row, { status: TRANSITIONS.unpublish.to, scheduledAt: null }, 'unpublish', user.id),
  );
  if (before.status === 'scheduled') {
    await afterCommit(deps, 'cancelScheduledPublish', () => deps.jobs.cancelScheduledPublish(id));
  }
  if (before.status === 'published') {
    await afterCommit(deps, 'enqueueChanged', () => deps.jobs.enqueueChanged(id));
  }
  return articleDto(deps.db, after);
}
