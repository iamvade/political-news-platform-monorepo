import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';
import { CategorySection } from '@/components/home/category-section';
import { LatestFeed } from '@/components/home/latest-feed';
import { ParliamentWeek } from '@/components/home/parliament-week';
import { TopStories } from '@/components/home/top-stories';
import { JsonLd } from '@/components/json-ld';
import { duringBuildOr, getHomepage, getLatestArticles, getParliamentWeek } from '@/lib/data';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';
import { getSiteInfo } from '@/lib/site';

// ISR: regenerated at most every minute, and immediately when the API revalidates `homepage`.
export const revalidate = 60;

const LATEST_COUNT = 10;

export const metadata: Metadata = { alternates: { canonical: '/' } };

async function loadHomepage() {
  const [homepage, latest, parliament] = await Promise.all([getHomepage(), getLatestArticles(LATEST_COUNT + 5), getParliamentWeek()]);
  return { homepage, latest, parliament };
}

export default async function HomePage() {
  const t = await getTranslations('home');
  const site = await getSiteInfo();
  const data = await duringBuildOr(loadHomepage, null);

  if (!data) {
    return (
      <main className="mx-auto max-w-page px-gutter py-12">
        <h1 className="sr-only">{site.name}</h1>
        <EmptyState title={t('unavailable')} />
      </main>
    );
  }

  const { homepage, latest, parliament } = data;
  const shown = new Set([homepage.hero?.id, ...homepage.featured.map((article) => article.id)]);
  const feed = latest.filter((article) => !shown.has(article.id)).slice(0, LATEST_COUNT);
  const nothingPublished = !homepage.hero && homepage.featured.length === 0 && feed.length === 0;

  return (
    <main className="mx-auto max-w-page space-y-10 px-gutter py-6">
      <h1 className="sr-only">{site.name}</h1>
      {nothingPublished ? (
        <EmptyState title={t('empty')} />
      ) : (
        <TopStories hero={homepage.hero} featured={homepage.featured} />
      )}
      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LatestFeed articles={feed} />
        </div>
        <ParliamentWeek week={parliament} />
      </div>
      {homepage.sections.map((section) => (
        <CategorySection key={section.category.slug} section={section} />
      ))}
      <JsonLd data={[organizationJsonLd(site), websiteJsonLd(site)]} />
    </main>
  );
}
