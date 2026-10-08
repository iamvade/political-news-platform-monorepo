import type { PublicArticle, PublicArticleSummary } from '@news/shared/schemas';
import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ArticleBody } from '@/components/article-body';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CorrectionNotice } from '@/components/correction-notice';
import { JsonLd } from '@/components/json-ld';
import { RelatedArticles, RelatedArticlesSkeleton } from '@/components/related-articles';
import { Tag } from '@/components/tag';
import { getArticle, getRelatedArticles } from '@/lib/data';
import { imageSources } from '@/lib/media';
import { parseIdSlug, routes } from '@/lib/routes';
import { articleMetadata, breadcrumbJsonLd, newsArticleJsonLd } from '@/lib/seo';
import { getSiteInfo } from '@/lib/site';

// ISR on demand: nothing is prerendered at build; each article renders on first visit, is cached with the
// `article:{id}` tag and regenerates when the API revalidates it (or after 5 minutes).
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ idSlug: string }> };

async function load(params: Props['params']) {
  const ref = parseIdSlug((await params).idSlug);
  if (!ref) notFound();
  return getArticle(ref.id, ref.slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return articleMetadata(await load(params), await getSiteInfo());
}

/** The related rail is extra: if its request fails, the article still renders without it. */
async function Related({ article }: { article: PublicArticle }) {
  let articles: PublicArticleSummary[];
  try {
    articles = await getRelatedArticles(article, 4);
  } catch (err) {
    console.warn('Related articles unavailable', err instanceof Error ? err.message : err);
    return null;
  }
  return <RelatedArticles articles={articles} />;
}

export default async function ArticlePage({ params }: Props) {
  const article = await load(params);
  const site = await getSiteInfo();
  const t = await getTranslations('article');
  const format = await getFormatter();
  const cover = article.cover ? imageSources(article.cover) : null;
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: 'long', timeStyle: 'short' });
  // Edits within a minute of publishing are not worth an "updated" line.
  const updated = new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 60_000;

  return (
    <main className="mx-auto max-w-page px-gutter py-6">
      <article className="mx-auto max-w-content space-y-6">
        <Breadcrumbs
          items={[
            { label: t('breadcrumbHome'), href: routes.home },
            ...(article.category ? [{ label: article.category.nameMn }] : []),
            { label: article.title },
          ]}
        />
        <header className="space-y-3">
          {(article.isBreaking || article.category) && (
            <p className="flex flex-wrap items-center gap-2">
              {article.isBreaking && <span className="type-label rounded-sm bg-breaking px-1.5 py-0.5 text-breaking-ink">{t('breaking')}</span>}
              {article.category && <span className="type-label text-accent">{article.category.nameMn}</span>}
            </p>
          )}
          <h1 className="type-display text-ink">{article.title}</h1>
          {article.lede && <p className="type-lede text-ink-muted">{article.lede}</p>}
          <div className="type-meta flex flex-wrap gap-x-3 gap-y-1 text-ink-subtle">
            <span>{t('byline', { author: article.author.displayName })}</span>
            <time dateTime={article.publishedAt}>{when(article.publishedAt)}</time>
            {updated && <time dateTime={article.updatedAt}>{t('updated', { date: when(article.updatedAt) })}</time>}
          </div>
        </header>

        {article.corrections.length > 0 && <CorrectionNotice corrections={article.corrections} />}

        {cover && article.cover && (
          <figure className="space-y-2">
            <img
              src={cover.src}
              srcSet={cover.srcSet}
              sizes="(min-width: 42rem) 42rem, 100vw"
              alt={article.cover.alt ?? ''}
              width={article.cover.width ?? undefined}
              height={article.cover.height ?? undefined}
              fetchPriority="high"
              className="w-full rounded-md bg-surface-muted"
            />
            {article.cover.credit && <figcaption className="type-meta text-ink-subtle">{t('credit', { credit: article.cover.credit })}</figcaption>}
          </figure>
        )}

        <ArticleBody html={article.bodyHtml} />

        {(article.tags.length > 0 || article.persons.length > 0 || article.organizations.length > 0) && (
          <footer className="space-y-4 border-t border-border pt-6">
            {article.persons.length > 0 && (
              <div>
                <h2 className="type-label mb-2 text-ink-subtle">{t('people')}</h2>
                <ul className="flex flex-wrap gap-2">
                  {article.persons.map((person) => (
                    <li key={person.id}>
                      <Link href={routes.person(person)} className="inline-flex min-h-8 items-center rounded-full border border-border px-3 text-sm text-ink hover:border-border-strong hover:underline">
                        {person.displayName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {article.organizations.length > 0 && (
              <div>
                <h2 className="type-label mb-2 text-ink-subtle">{t('organizations')}</h2>
                <p className="text-sm text-ink-muted">{article.organizations.map((org) => org.nameMn).join(' · ')}</p>
              </div>
            )}
            {article.tags.length > 0 && (
              <div>
                <h2 className="type-label mb-2 text-ink-subtle">{t('tags')}</h2>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag) => (
                    <Tag key={tag.slug} tag={tag} />
                  ))}
                </div>
              </div>
            )}
          </footer>
        )}
      </article>
      {/* Streams in after the article. This boundary is inside the page, below load()'s notFound(), so a missing
          article still answers a real 404 (see docs/technical/features/public-site.md, "Loading and errors"). */}
      <div className="mx-auto mt-12 max-w-content">
        <Suspense fallback={<RelatedArticlesSkeleton />}>
          <Related article={article} />
        </Suspense>
      </div>
      <JsonLd
        data={[
          newsArticleJsonLd(article, site),
          // No category crumb: it needs a URL, and section pages don't exist yet.
          breadcrumbJsonLd(site, [
            { name: t('breadcrumbHome'), path: routes.home },
            { name: article.title, path: routes.article(article) },
          ]),
        ]}
      />
    </main>
  );
}
