import type { PublicArticleSummary } from '@news/shared/schemas';
import { useTranslations } from 'next-intl';
import { ArticleCard } from '@/components/article-card';
import { EmptyState } from '@/components/empty-state';
import { SectionHeading } from '@/components/section-heading';

/** Newest articles, newest first. */
export function LatestFeed({ articles }: { articles: PublicArticleSummary[] }) {
  const t = useTranslations('home');
  return (
    <section aria-labelledby="latest-title">
      <SectionHeading id="latest-title">{t('latest')}</SectionHeading>
      {articles.length === 0 ? (
        <EmptyState title={t('latestEmpty')} />
      ) : (
        <div className="divide-y divide-border">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} size="compact" />
          ))}
        </div>
      )}
    </section>
  );
}
