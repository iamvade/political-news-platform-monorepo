import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArticleCard } from '@/components/article-card';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { EmptyState } from '@/components/empty-state';
import { JsonLd } from '@/components/json-ld';
import { PartyBadge } from '@/components/party-badge';
import { SectionHeading } from '@/components/section-heading';
import { SourceLink } from '@/components/source-link';
import { getPerson, getPersonArticles } from '@/lib/data';
import { imageSources } from '@/lib/media';
import { parseIdSlug, routes } from '@/lib/routes';
import { personJsonLd, personMetadata } from '@/lib/seo';
import { getSiteInfo } from '@/lib/site';

// ISR on demand, tagged `person:{id}` (data edits) and `people` (party changes, imports).
export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ idSlug: string }> };

async function load(params: Props['params']) {
  const ref = parseIdSlug((await params).idSlug);
  if (!ref) notFound();
  return { ref, person: await getPerson(ref.id, ref.slug) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return personMetadata((await load(params)).person, await getSiteInfo());
}

export default async function PersonPage({ params }: Props) {
  const { ref, person } = await load(params);
  const [articles, site, t, format] = await Promise.all([getPersonArticles(ref.id, ref.slug, 8), getSiteInfo(), getTranslations('person'), getFormatter()]);
  const photo = person.photo ? imageSources(person.photo) : null;
  const roles = person.currentPositions.filter((position) => position.organization.type !== 'party');
  const since = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: 'medium', timeZone: 'UTC' });

  return (
    <main className="mx-auto max-w-page space-y-8 px-gutter py-6">
      <Breadcrumbs items={[{ label: t('breadcrumbHome'), href: routes.home }, { label: t('breadcrumbPeople'), href: routes.people }, { label: person.displayName }]} />
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="size-28 shrink-0 overflow-hidden rounded-full bg-surface-muted">
          {photo ? (
            <img src={photo.src} srcSet={photo.srcSet} sizes="112px" alt={person.photo?.alt ?? ''} className="size-full object-cover" fetchPriority="high" />
          ) : (
            <span aria-hidden className="flex size-full items-center justify-center font-serif text-4xl font-bold text-ink-subtle">
              {Array.from(person.givenNameMn)[0]}
            </span>
          )}
        </div>
        <div className="space-y-2">
          <h1 className="type-display text-ink">{person.displayName}</h1>
          {roles.length > 0 && <p className="type-lede text-ink-muted">{[...new Set(roles.map((role) => role.titleMn))].join(', ')}</p>}
          <div className="flex flex-wrap items-center gap-2">
            {person.party && <PartyBadge party={person.party} />}
            {person.constituency && <span className="type-meta text-ink-subtle">{person.constituency.nameMn}</span>}
          </div>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          {person.bioMn && (
            <section aria-labelledby="bio-title">
              <SectionHeading id="bio-title">{t('bio')}</SectionHeading>
              <p className="type-body whitespace-pre-line text-ink">{person.bioMn}</p>
            </section>
          )}
          <section aria-labelledby="articles-title">
            <SectionHeading id="articles-title">{t('articles')}</SectionHeading>
            {articles.length === 0 ? (
              <EmptyState title={t('articlesEmpty')} />
            ) : (
              <div className="divide-y divide-border">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} size="compact" />
                ))}
              </div>
            )}
          </section>
        </div>
        <section aria-labelledby="positions-title">
          <SectionHeading id="positions-title">{t('positions')}</SectionHeading>
          {person.currentPositions.length === 0 ? (
            <EmptyState title={t('positionsEmpty')} />
          ) : (
            <ul className="divide-y divide-border">
              {person.currentPositions.map((position, index) => (
                <li key={`${position.organization.slug}-${index}`} className="flex items-start justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{position.titleMn}</p>
                    <p className="text-sm text-ink-muted">{position.organization.nameMn}</p>
                    <p className="type-meta text-ink-subtle">{t('since', { date: since(position.startDate) })}</p>
                  </div>
                  <SourceLink href={position.sourceUrl} variant="icon" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <JsonLd data={personJsonLd(person, site)} />
    </main>
  );
}
