import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { SectionArticles, SectionHeader } from '@/components/section-articles';
import { getCategory, getCategoryArticles } from '@/lib/data';
import { parsePage, parseSlug, routes } from '@/lib/routes';
import { sectionPageMetadata, SectionJsonLd } from '../section-shared';

// Pages 2+ of a section (/section/{slug}/{n}). A path segment, not ?page=, so they stay ISR and CDN-cacheable.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string; page: string }> };

/**
 * Rendered without a Suspense boundary: whether page n exists is only known from the list's total, and a
 * missing page must answer a real 404 before anything streams.
 */
async function load(params: Props['params']) {
  const segments = await params;
  const slug = parseSlug(segments.slug);
  const page = parsePage(segments.page);
  if (!slug || !page) notFound();
  if (page === 1) permanentRedirect(routes.section(slug));
  const [category, { data, pagination }] = await Promise.all([getCategory(slug), getCategoryArticles(slug, page)]);
  if (page > pagination.totalPages) notFound();
  return { category, page, articles: data, totalPages: pagination.totalPages };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, page } = await load(params);
  return sectionPageMetadata(category, page);
}

export default async function SectionPageN({ params }: Props) {
  const { category, page, articles, totalPages } = await load(params);
  return (
    <main className="mx-auto max-w-page space-y-8 px-gutter py-6">
      <SectionHeader category={category} page={page} />
      <SectionArticles category={category} articles={articles} page={page} totalPages={totalPages} />
      <SectionJsonLd category={category} page={page} articles={articles} />
    </main>
  );
}
