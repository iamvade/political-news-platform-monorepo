import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SectionArticles, SectionArticlesSkeleton, SectionHeader } from '@/components/section-articles';
import { getCategoryArticles, type Category } from '@/lib/data';
import { loadCategory, sectionPageMetadata, SectionJsonLd } from './section-shared';

// ISR on demand, like /news: each section renders on first visit and is refreshed when the API revalidates
// `articles` (every publish, edit and unpublish), or after 5 minutes.
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return sectionPageMetadata(await loadCategory((await params).slug), 1);
}

/** The article list streams in under the header (the skeleton shows meanwhile). */
async function SectionList({ category }: { category: Category }) {
  // Errors are not caught: ISR then keeps serving the last good page instead of caching an empty one.
  const { data, pagination } = await getCategoryArticles(category.slug, 1);
  return (
    <>
      <SectionArticles category={category} articles={data} page={1} totalPages={pagination.totalPages} />
      <SectionJsonLd category={category} page={1} articles={data} />
    </>
  );
}

export default async function SectionPage({ params }: Props) {
  const category = await loadCategory((await params).slug);
  return (
    <main className="mx-auto max-w-page space-y-8 px-gutter py-6">
      <SectionHeader category={category} page={1} />
      {/* Below loadCategory()'s notFound(), so an unknown section still answers a real 404 (no loading.tsx;
          see docs/technical/features/public-site.md, "Loading and errors"). */}
      <Suspense fallback={<SectionArticlesSkeleton />}>
        <SectionList category={category} />
      </Suspense>
    </main>
  );
}
