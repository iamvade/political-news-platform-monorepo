import type { PublicHomepage } from '@news/shared/schemas';
import { ArticleCard } from '@/components/article-card';
import { SectionHeading } from '@/components/section-heading';

type Section = PublicHomepage['sections'][number];

/** One category rail. Renders nothing when the category has no articles to show. */
export function CategorySection({ section }: { section: Section }) {
  if (section.articles.length === 0) return null;
  const id = `section-${section.category.slug}`;
  const [first, ...rest] = section.articles;
  return (
    <section aria-labelledby={id}>
      <SectionHeading id={id}>{section.category.nameMn}</SectionHeading>
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
