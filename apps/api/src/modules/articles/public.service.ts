import { ErrorCode, personDisplayName, type PublicArticle, type PublicArticleSummary } from '@news/shared/schemas';
import type { ContentDoc } from '@news/shared/content';
import { and, asc, count, desc, eq, exists, inArray, isNull, notInArray, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import {
  articleBills,
  articleOrganizations,
  articlePersons,
  articleTags,
  articles,
  bills,
  categories,
  corrections,
  media,
  organizations,
  persons,
  tags,
  users,
} from '../../db/schema/index';
import { iso } from '../../lib/crud';
import { AppError } from '../../lib/errors';
import { toPublicMedia } from '../../lib/media';

export interface ArticleFilter {
  categorySlug?: string;
  categoryId?: number;
  tagSlug?: string;
  personId?: number;
  /** Only these articles (homepage pins). */
  ids?: number[];
  /** Leave these out (homepage: already shown in hero/featured). */
  excludeIds?: number[];
  page: number;
  pageSize: number;
}

const published = () => and(eq(articles.status, 'published'), isNull(articles.deletedAt));

const summaryColumns = {
  article: articles,
  category: { slug: categories.slug, nameMn: categories.nameMn, nameEn: categories.nameEn },
  cover: { status: media.status, alt: media.alt, credit: media.credit, width: media.width, height: media.height, variants: media.variants },
};

type SummaryRow = {
  article: typeof articles.$inferSelect;
  category: { slug: string; nameMn: string; nameEn: string | null } | null;
  cover: Parameters<typeof toPublicMedia>[0];
};

function toSummary(row: SummaryRow, mediaBase: string | undefined): PublicArticleSummary {
  return {
    id: row.article.id,
    slug: row.article.slug,
    title: row.article.title,
    lede: row.article.lede,
    isBreaking: row.article.isBreaking,
    publishedAt: iso(row.article.publishedAt!),
    updatedAt: iso(row.article.updatedAt),
    category: row.category,
    cover: toPublicMedia(row.cover, mediaBase),
  };
}

/** Published articles, newest first, optionally filtered by category, tag slug, tagged person or id list. */
export async function listPublishedArticles(
  db: Db,
  mediaBase: string | undefined,
  filter: ArticleFilter,
): Promise<{ items: PublicArticleSummary[]; total: number }> {
  const conditions: SQL[] = [published()!];
  if (filter.categorySlug) conditions.push(eq(categories.slug, filter.categorySlug));
  if (filter.categoryId) conditions.push(eq(articles.categoryId, filter.categoryId));
  if (filter.ids) conditions.push(inArray(articles.id, filter.ids));
  if (filter.excludeIds?.length) conditions.push(notInArray(articles.id, filter.excludeIds));
  if (filter.tagSlug) {
    conditions.push(
      exists(
        db
          .select({ one: articleTags.articleId })
          .from(articleTags)
          .innerJoin(tags, eq(tags.id, articleTags.tagId))
          .where(and(eq(articleTags.articleId, articles.id), eq(tags.slug, filter.tagSlug))),
      ),
    );
  }
  if (filter.personId) {
    conditions.push(
      exists(
        db
          .select({ one: articlePersons.articleId })
          .from(articlePersons)
          .where(and(eq(articlePersons.articleId, articles.id), eq(articlePersons.personId, filter.personId))),
      ),
    );
  }
  const where = and(...conditions);

  const [total] = await db
    .select({ n: count() })
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .where(where);
  const rows = await db
    .select(summaryColumns)
    .from(articles)
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(media, and(eq(media.id, articles.coverMediaId), isNull(media.deletedAt)))
    .where(where)
    .orderBy(desc(articles.publishedAt), desc(articles.id))
    .limit(filter.pageSize)
    .offset((filter.page - 1) * filter.pageSize);

  return { items: rows.map((row) => toSummary(row, mediaBase)), total: total?.n ?? 0 };
}

/** A published article by slug. Once-published-now-unpublished → 410; never published / unknown → 404. */
export async function getPublishedArticle(db: Db, mediaBase: string | undefined, slug: string): Promise<PublicArticle> {
  const [row] = await db
    .select({ ...summaryColumns, authorName: users.displayName })
    .from(articles)
    .innerJoin(users, eq(users.id, articles.authorId))
    .leftJoin(categories, eq(categories.id, articles.categoryId))
    .leftJoin(media, and(eq(media.id, articles.coverMediaId), isNull(media.deletedAt)))
    .where(and(eq(articles.slug, slug), isNull(articles.deletedAt)))
    .limit(1);

  if (!row || row.article.status !== 'published') {
    if (row?.article.publishedAt) throw new AppError(410, ErrorCode.GONE, 'Article is no longer published');
    throw new AppError(404, ErrorCode.NOT_FOUND, 'Article not found');
  }
  const id = row.article.id;

  const [tagRows, personRows, orgRows, billRows, correctionRows] = await Promise.all([
    db
      .select({ slug: tags.slug, nameMn: tags.nameMn, nameEn: tags.nameEn })
      .from(articleTags)
      .innerJoin(tags, eq(tags.id, articleTags.tagId))
      .where(eq(articleTags.articleId, id))
      .orderBy(asc(tags.nameMn)),
    db
      .select({ id: persons.id, slug: persons.slug, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn })
      .from(articlePersons)
      .innerJoin(persons, and(eq(persons.id, articlePersons.personId), isNull(persons.deletedAt)))
      .where(eq(articlePersons.articleId, id))
      .orderBy(asc(persons.givenNameMn)),
    db
      .select({
        slug: organizations.slug,
        type: organizations.type,
        nameMn: organizations.nameMn,
        nameEn: organizations.nameEn,
        shortNameMn: organizations.shortNameMn,
        color: organizations.color,
      })
      .from(articleOrganizations)
      .innerJoin(organizations, and(eq(organizations.id, articleOrganizations.organizationId), isNull(organizations.deletedAt)))
      .where(eq(articleOrganizations.articleId, id))
      .orderBy(asc(organizations.nameMn)),
    db
      .select({ slug: bills.slug, titleMn: bills.titleMn })
      .from(articleBills)
      .innerJoin(bills, eq(bills.id, articleBills.billId))
      .where(eq(articleBills.articleId, id)),
    db
      .select({ date: corrections.date, description: corrections.description, reason: corrections.reason })
      .from(corrections)
      .where(and(eq(corrections.entityType, 'article'), eq(corrections.entityId, id)))
      .orderBy(asc(corrections.date), asc(corrections.id)),
  ]);

  return {
    ...toSummary(row, mediaBase),
    bodyHtml: row.article.bodyHtml,
    bodyJson: row.article.bodyJson as ContentDoc,
    author: { displayName: row.authorName },
    tags: tagRows,
    persons: personRows.map((p) => ({ ...p, displayName: personDisplayName(p.patronymicMn, p.givenNameMn) })),
    organizations: orgRows,
    bills: billRows,
    corrections: correctionRows,
  };
}

export async function getTaxonomy(db: Db, kind: 'category' | 'tag', slug: string) {
  const table = kind === 'category' ? categories : tags;
  const [row] = await db
    .select({ slug: table.slug, nameMn: table.nameMn, nameEn: table.nameEn })
    .from(table)
    .where(eq(table.slug, slug))
    .limit(1);
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, `${kind === 'category' ? 'Category' : 'Tag'} not found`);
  return row;
}
