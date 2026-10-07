import { HOMEPAGE_FEATURED_SLOTS, type PublicArticleSummary, type PublicHomepage } from '@news/shared/schemas';
import { asc, inArray, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { categories } from '../../db/schema/index';
import { iso } from '../../lib/crud';
import { listPublishedArticles } from '../articles/public.service';
import { EMPTY_ZONES, latestLayout } from './service';

/** Articles per category rail. */
export const SECTION_SIZE = 6;

/**
 * The live homepage, resolved for readers. Pinned articles that are no longer published are dropped and the
 * slots are filled with the latest published articles, so the page never has holes. With no saved layout the
 * sections are the top-level categories in their `sort_order`.
 */
export async function getPublicHomepage(db: Db, mediaBase: string | undefined): Promise<PublicHomepage> {
  const row = await latestLayout(db);
  const zones = row?.zones ?? EMPTY_ZONES;

  const pinnedIds = [...(zones.heroArticleId ? [zones.heroArticleId] : []), ...zones.featuredArticleIds];
  const pinned = pinnedIds.length
    ? (await listPublishedArticles(db, mediaBase, { ids: pinnedIds, page: 1, pageSize: pinnedIds.length })).items
    : [];
  const byId = new Map(pinned.map((article) => [article.id, article]));

  let hero: PublicArticleSummary | null = (zones.heroArticleId && byId.get(zones.heroArticleId)) || null;
  const featured = zones.featuredArticleIds.flatMap((id) => byId.get(id) ?? []);
  const used = () => [...(hero ? [hero.id] : []), ...featured.map((article) => article.id)];

  const missing = (hero ? 0 : 1) + (HOMEPAGE_FEATURED_SLOTS - featured.length);
  if (missing > 0) {
    const latest = (await listPublishedArticles(db, mediaBase, { excludeIds: used(), page: 1, pageSize: missing })).items;
    if (!hero) hero = latest.shift() ?? null;
    featured.push(...latest);
  }

  const sectionCategories = row
    ? zones.sectionCategoryIds.length
      ? await db
          .select({ id: categories.id, slug: categories.slug, nameMn: categories.nameMn, nameEn: categories.nameEn })
          .from(categories)
          .where(inArray(categories.id, zones.sectionCategoryIds))
      : []
    : await db
        .select({ id: categories.id, slug: categories.slug, nameMn: categories.nameMn, nameEn: categories.nameEn })
        .from(categories)
        .where(isNull(categories.parentId))
        .orderBy(asc(categories.sortOrder), asc(categories.id));
  // Keep the editor's order (the SQL `in` list has none).
  const ordered = row
    ? zones.sectionCategoryIds.flatMap((id) => sectionCategories.find((category) => category.id === id) ?? [])
    : sectionCategories;

  const exclude = used();
  const sections = await Promise.all(
    ordered.map(async ({ id, ...category }) => ({
      category,
      articles: (await listPublishedArticles(db, mediaBase, { categoryId: id, excludeIds: exclude, page: 1, pageSize: SECTION_SIZE })).items,
    })),
  );

  return { hero, featured, sections, updatedAt: row ? iso(row.createdAt) : null };
}
