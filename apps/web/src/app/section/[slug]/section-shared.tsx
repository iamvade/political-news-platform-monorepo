import type { PublicArticleSummary } from '@news/shared/schemas';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/json-ld';
import { getCategory, SECTION_PAGE_SIZE, type Category } from '@/lib/data';
import { parseSlug, routes } from '@/lib/routes';
import { breadcrumbJsonLd, collectionPageJsonLd, sectionMetadata } from '@/lib/seo';
import { getSiteInfo } from '@/lib/site';

// Shared by /section/{slug} (page 1) and /section/{slug}/{n}. Not a route file: Next only routes page/route files.

/** The category for a URL segment; a malformed slug is not found without an API request. */
export async function loadCategory(segment: string): Promise<Category> {
  const slug = parseSlug(segment);
  if (!slug) notFound();
  return getCategory(slug);
}

async function sectionTexts(category: Category, page: number) {
  const t = await getTranslations('section');
  return {
    title: page > 1 ? t('pageTitle', { category: category.nameMn, page }) : category.nameMn,
    description: t('description', { category: category.nameMn }),
  };
}

export async function sectionPageMetadata(category: Category, page: number): Promise<Metadata> {
  return sectionMetadata(category, { page, ...(await sectionTexts(category, page)) }, await getSiteInfo());
}

/** CollectionPage (this page's articles) and BreadcrumbList, matching the visible breadcrumbs. */
export async function SectionJsonLd({ category, page, articles }: { category: Category; page: number; articles: PublicArticleSummary[] }) {
  const site = await getSiteInfo();
  const t = await getTranslations();
  const { title, description } = await sectionTexts(category, page);
  const path = routes.section(category.slug, page);
  const crumbs = [
    { name: t('section.breadcrumbHome'), path: routes.home },
    { name: category.nameMn, path: routes.section(category.slug) },
    ...(page > 1 ? [{ name: t('pagination.page', { page }), path }] : []),
  ];
  return (
    <JsonLd
      data={[collectionPageJsonLd(site, { path, name: title, description }, articles, (page - 1) * SECTION_PAGE_SIZE), breadcrumbJsonLd(site, crumbs)]}
    />
  );
}
