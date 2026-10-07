import { ErrorCode } from '@news/shared/schemas';
import { and, eq, inArray, isNull, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db, Tx } from '../../db/client';
import {
  articleBills,
  articleOrganizations,
  articlePersons,
  articleTags,
  bills,
  organizations,
  persons,
  tags,
} from '../../db/schema/index';
import { AppError } from '../../lib/errors';

export interface ArticleLinks {
  tagIds: number[];
  personIds: number[];
  organizationIds: number[];
  billIds: number[];
}

export const LINK_FIELDS = ['tagIds', 'personIds', 'organizationIds', 'billIds'] as const;
export type LinkField = (typeof LINK_FIELDS)[number];

interface LinkSpec {
  join: typeof articleTags | typeof articlePersons | typeof articleOrganizations | typeof articleBills;
  /** Property name of the target id on the join row (for inserts). */
  key: 'tagId' | 'personId' | 'organizationId' | 'billId';
  joinArticleId: AnyPgColumn;
  joinTargetId: AnyPgColumn;
  target: PgTable;
  targetId: AnyPgColumn;
  /** Soft-deleted targets cannot be linked. */
  targetDeletedAt?: AnyPgColumn;
  label: string;
}

const SPECS: Record<LinkField, LinkSpec> = {
  tagIds: { join: articleTags, key: 'tagId', joinArticleId: articleTags.articleId, joinTargetId: articleTags.tagId, target: tags, targetId: tags.id, label: 'tag' },
  personIds: {
    join: articlePersons,
    key: 'personId',
    joinArticleId: articlePersons.articleId,
    joinTargetId: articlePersons.personId,
    target: persons,
    targetId: persons.id,
    targetDeletedAt: persons.deletedAt,
    label: 'person',
  },
  organizationIds: {
    join: articleOrganizations,
    key: 'organizationId',
    joinArticleId: articleOrganizations.articleId,
    joinTargetId: articleOrganizations.organizationId,
    target: organizations,
    targetId: organizations.id,
    targetDeletedAt: organizations.deletedAt,
    label: 'organization',
  },
  billIds: { join: articleBills, key: 'billId', joinArticleId: articleBills.articleId, joinTargetId: articleBills.billId, target: bills, targetId: bills.id, label: 'bill' },
};

const emptyLinks = (): ArticleLinks => ({ tagIds: [], personIds: [], organizationIds: [], billIds: [] });

/** Linked ids for the given articles (sorted, for stable responses and snapshots). */
export async function loadLinks(db: Db | Tx, articleIds: number[]): Promise<Map<number, ArticleLinks>> {
  const result = new Map(articleIds.map((id) => [id, emptyLinks()]));
  if (articleIds.length === 0) return result;
  for (const field of LINK_FIELDS) {
    const spec = SPECS[field];
    const rows = (await db
      .select({ articleId: spec.joinArticleId, targetId: spec.joinTargetId })
      .from(spec.join)
      .where(inArray(spec.joinArticleId, articleIds))) as { articleId: number; targetId: number }[];
    for (const row of rows) result.get(row.articleId)?.[field].push(row.targetId);
  }
  for (const links of result.values()) for (const field of LINK_FIELDS) links[field].sort((a, b) => a - b);
  return result;
}

/** Replaces the provided link sets. Unknown or soft-deleted targets → 400 REFERENCE_NOT_FOUND (nothing written). */
export async function replaceLinks(tx: Tx, articleId: number, links: Partial<ArticleLinks>): Promise<void> {
  for (const field of LINK_FIELDS) {
    const ids = links[field];
    if (ids === undefined) continue;
    const spec = SPECS[field];

    if (ids.length > 0) {
      const conditions: SQL[] = [inArray(spec.targetId, ids)];
      if (spec.targetDeletedAt) conditions.push(isNull(spec.targetDeletedAt));
      const found = (await tx.select({ id: spec.targetId }).from(spec.target).where(and(...conditions))) as { id: number }[];
      const missing = ids.filter((id) => !found.some((row) => row.id === id));
      if (missing.length > 0) {
        throw new AppError(400, ErrorCode.REFERENCE_NOT_FOUND, `Unknown or deleted ${spec.label} id(s): ${missing.join(', ')}`);
      }
    }

    await tx.delete(spec.join).where(eq(spec.joinArticleId, articleId));
    if (ids.length > 0) {
      // The four join tables share the shape { articleId, <key> }; the union type cannot express that, hence the cast.
      await tx.insert(spec.join).values(ids.map((id) => ({ articleId, [spec.key]: id })) as never);
    }
  }
}
