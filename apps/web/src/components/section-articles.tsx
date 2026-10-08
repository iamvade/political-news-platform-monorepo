import type { PublicArticleSummary } from '@news/shared/schemas';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';
import { ArticleCard } from './article-card';
import { Breadcrumbs } from './breadcrumbs';
import { EmptyState } from './empty-state';
import { Pagination } from './pagination';
import { Skeleton } from './skeleton';

type Category = { slug: string; nameMn: string };

/** Compact cards beside the lead on page 1, like the homepage's top stories. */
const BESIDE_LEAD = 4;

/** Breadcrumbs and the section name. From page 2 on, the page number is the last crumb. */
export function SectionHeader({ category, page }: { category: Category; page: number }) {
  const t = useTranslations('section');
  const tPagination = useTranslations('pagination');
  const crumbs =
    page > 1
      ? [
          { label: t('breadcrumbHome'), href: routes.home },
          { label: category.nameMn, href: routes.section(category.slug) },
          { label: tPagination('page', { page }) },
        ]
      : [{ label: t('breadcrumbHome'), href: routes.home }, { label: category.nameMn }];
  return (
    <header className="space-y-3">
      <Breadcrumbs items={crumbs} />
      <h1 className="type-display text-ink">{category.nameMn}</h1>
    </header>
  );
}

interface SectionArticlesProps {
  category: Category;
  articles: PublicArticleSummary[];
  page: number;
  totalPages: number;
}

/**
 * One page of a section. Page 1 opens with a lead card and four compact ones beside it; every page then has a
 * grid of standard cards and the pagination. An empty section shows a calm message instead.
 */
export function SectionArticles({ category, articles, page, totalPages }: SectionArticlesProps) {
  const t = useTranslations('section');
  if (articles.length === 0) {
    return (
      <EmptyState title={t('empty')}>
        <Link href={routes.home} className="text-link underline underline-offset-2">
          {t('home')}
        </Link>
      </EmptyState>
    );
  }

  const lead = page === 1 ? articles[0] : undefined;
  const rest = lead ? articles.slice(1) : articles;
  const beside = lead ? rest.slice(0, BESIDE_LEAD) : [];
  const grid = lead ? rest.slice(BESIDE_LEAD) : rest;

  return (
    <div className="space-y-8">
      {lead && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ArticleCard article={lead} size="lead" priority headingLevel={2} />
          </div>
          {beside.length > 0 && (
            <div className="grid content-start gap-x-6 sm:grid-cols-2 lg:grid-cols-1 lg:divide-y lg:divide-border">
              {beside.map((article) => (
                <ArticleCard key={article.id} article={article} size="compact" headingLevel={2} />
              ))}
            </div>
          )}
        </div>
      )}
      {grid.length > 0 && (
        <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {grid.map((article, index) => (
            // Without a lead (page 2 on), the first card is the likely LCP image.
            <ArticleCard key={article.id} article={article} priority={!lead && index === 0} headingLevel={2} />
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} hrefFor={(n) => routes.section(category.slug, n)} />
    </div>
  );
}

/** Loading shape of page 1 (lead, the compact column, a row of the grid), so nothing shifts when it arrives. */
export function SectionArticlesSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="space-y-3">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
