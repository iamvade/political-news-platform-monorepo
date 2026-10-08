import type { PublicHomepage } from '@news/shared/schemas';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArticleCard } from '@/components/article-card';
import { SectionHeading } from '@/components/section-heading';
import { routes } from '@/lib/routes';

type Section = PublicHomepage['sections'][number];

/** One category rail. Renders nothing when the category has no articles to show. */
export function CategorySection({ section }: { section: Section }) {
  const t = useTranslations('home');
  if (section.articles.length === 0) return null;
  const id = `section-${section.category.slug}`;
  const [first, ...rest] = section.articles;
  return (
    <section aria-labelledby={id}>
      <SectionHeading
        id={id}
        aside={
          // The negative margin keeps a 44px touch target without making the heading row taller.
          <Link
            href={routes.section(section.category.slug)}
            aria-label={t('seeAllLabel', { category: section.category.nameMn })}
            className="-my-3 inline-flex min-h-11 items-center text-link hover:underline"
          >
            {t('seeAll')}
          </Link>
        }
      >
        {section.category.nameMn}
      </SectionHeading>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <ArticleCard article={first!} />
        <div className="divide-y divide-border sm:col-span-1 lg:col-span-2 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:divide-y-0">
          {rest.map((article) => (
            <ArticleCard key={article.id} article={article} size="compact" />
          ))}
        </div>
      </div>
    </section>
  );
}
