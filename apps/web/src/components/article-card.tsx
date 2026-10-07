import type { PublicArticleSummary } from '@news/shared/schemas';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { imageSources } from '@/lib/media';
import { routes } from '@/lib/routes';

export type ArticleCardSize = 'lead' | 'standard' | 'compact';

interface ArticleCardProps {
  article: PublicArticleSummary;
  size?: ArticleCardSize;
  /** Load the image eagerly with high priority (the first lead card on a page, for LCP). */
  priority?: boolean;
  headingLevel?: 2 | 3;
}

const IMAGE_SIZES: Record<ArticleCardSize, string> = {
  lead: '(min-width: 72rem) 72rem, 100vw',
  standard: '(min-width: 64rem) 24rem, (min-width: 40rem) 50vw, 100vw',
  compact: '72px',
};

const HEADLINE: Record<ArticleCardSize, string> = {
  lead: 'type-display',
  standard: 'type-title',
  compact: 'type-title text-base',
};

/**
 * Article teaser in three sizes. The headline link is stretched over the whole card, so there is one link
 * per card (screen readers hear the headline once); the image is decorative here.
 */
export function ArticleCard({ article, size = 'standard', priority = false, headingLevel = 3 }: ArticleCardProps) {
  const t = useTranslations('article');
  const format = useFormatter();
  const Heading = `h${headingLevel}` as const;
  const image = article.cover ? imageSources(article.cover) : null;
  const href = routes.article(article);

  const img = image && (
    <img
      src={image.src}
      srcSet={image.srcSet}
      sizes={IMAGE_SIZES[size]}
      alt=""
      width={article.cover?.width ?? undefined}
      height={article.cover?.height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className="size-full object-cover"
    />
  );

  const labels = (article.isBreaking || article.category) && (
    <p className="flex flex-wrap items-center gap-2">
      {article.isBreaking && <span className="type-label rounded-sm bg-breaking px-1.5 py-0.5 text-breaking-ink">{t('breaking')}</span>}
      {article.category && <span className="type-label text-accent">{article.category.nameMn}</span>}
    </p>
  );

  const time = (
    <time dateTime={article.publishedAt} className="type-meta text-ink-subtle">
      {format.dateTime(new Date(article.publishedAt), { dateStyle: 'medium', timeStyle: 'short' })}
    </time>
  );

  const headline = (
    <Heading className={`${HEADLINE[size]} text-ink group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4`}>
      <Link href={href} className="after:absolute after:inset-0">
        {article.title}
      </Link>
    </Heading>
  );

  if (size === 'compact') {
    return (
      <article className="group relative flex gap-3 py-3">
        <div className="min-w-0 flex-1 space-y-1">
          {labels}
          {headline}
          {time}
        </div>
        {img && <div className="size-[72px] shrink-0 overflow-hidden rounded-md bg-surface-muted">{img}</div>}
      </article>
    );
  }

  return (
    <article className="group relative flex flex-col gap-3" data-size={size}>
      {img && <div className="aspect-video overflow-hidden rounded-md bg-surface-muted">{img}</div>}
      <div className="space-y-2">
        {labels}
        {headline}
        {size === 'lead' && article.lede && <p className="type-lede text-ink-muted">{article.lede}</p>}
        {time}
      </div>
    </article>
  );
}
