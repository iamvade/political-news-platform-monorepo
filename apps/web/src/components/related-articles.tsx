import type { PublicArticleSummary } from '@news/shared/schemas';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { ArticleCard } from './article-card';
import { SectionHeading } from './section-heading';
import { Skeleton } from './skeleton';

/** "Related news" rail under an article (compact cards). Renders nothing when there is nothing to show. */
export function RelatedArticles({ articles }: { articles: PublicArticleSummary[] }) {
  const t = useTranslations('article');
  const headingId = useId();
  if (articles.length === 0) return null;
  return (
    <section aria-labelledby={headingId}>
      <SectionHeading id={headingId}>{t('related')}</SectionHeading>
      <div className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} size="compact" />
        ))}
      </div>
    </section>
  );
}

/** Same shape as `RelatedArticles` with four compact cards, so nothing shifts when the rail arrives. */
export function RelatedArticlesSkeleton() {
  const t = useTranslations('article');
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} aria-busy="true">
      <SectionHeading id={headingId}>{t('related')}</SectionHeading>
      <div className="divide-y divide-border sm:grid sm:grid-cols-2 sm:gap-x-6 sm:divide-y-0">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex gap-3 py-3">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
            <Skeleton className="size-[72px] shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}
