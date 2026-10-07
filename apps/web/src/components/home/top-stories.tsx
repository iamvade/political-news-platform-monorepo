import type { PublicArticleSummary } from '@news/shared/schemas';
import { useTranslations } from 'next-intl';
import { ArticleCard } from '@/components/article-card';

/** Hero (lead card, loaded first) and the featured slots: beside the hero on large screens, below it on phones. */
export function TopStories({ hero, featured }: { hero: PublicArticleSummary | null; featured: PublicArticleSummary[] }) {
  const t = useTranslations('home');
  if (!hero && featured.length === 0) return null;
  return (
    <section aria-label={t('topStories')} className="grid gap-6 lg:grid-cols-3">
      {hero && (
        <div className="lg:col-span-2">
          <ArticleCard article={hero} size="lead" priority headingLevel={2} />
        </div>
      )}
      {featured.length > 0 && (
        <div className="grid content-start gap-x-6 sm:grid-cols-2 lg:grid-cols-1 lg:divide-y lg:divide-border">
          {featured.map((article) => (
            <ArticleCard key={article.id} article={article} size="compact" headingLevel={3} />
          ))}
        </div>
      )}
    </section>
  );
}
