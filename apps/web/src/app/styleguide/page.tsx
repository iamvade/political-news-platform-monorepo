import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArticleCard } from '@/components/article-card';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CorrectionNotice } from '@/components/correction-notice';
import { Pagination } from '@/components/pagination';
import { PartyBadge } from '@/components/party-badge';
import { PersonCard } from '@/components/person-card';
import { RelatedArticles, RelatedArticlesSkeleton } from '@/components/related-articles';
import { SourceLink } from '@/components/source-link';
import { Tag } from '@/components/tag';
import { ALPHABET_LOWER, ALPHABET_UPPER, ARTICLES, CORRECTIONS, CRUMBS, GLYPH_LINE, PANGRAM, PARTIES, PEOPLE, SOURCE_URL, TAGS, TYPE_SAMPLES } from './samples';

// Dev/preview tool: 404 in production unless STYLEGUIDE_ENABLED=true; never indexed.
const enabled = () => process.env.NODE_ENV !== 'production' || process.env.STYLEGUIDE_ENABLED === 'true';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('styleguide');
  return { title: t('title'), robots: { index: false, follow: false } };
}

const COLOR_TOKENS = [
  'canvas',
  'surface',
  'surface-muted',
  'ink',
  'ink-muted',
  'ink-subtle',
  'border',
  'border-strong',
  'accent',
  'accent-ink',
  'link',
  'focus',
  'breaking',
  'breaking-ink',
  'notice-bg',
  'notice-border',
  'notice-ink',
];

const SPACING_STEPS = [1, 2, 3, 4, 6, 8, 12, 16];

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 space-y-4 border-t border-border pt-8">
      <div className="space-y-1">
        <h2 id={`${id}-title`} className="type-headline">
          {title}
        </h2>
        {note && <p className="max-w-content text-sm text-ink-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="type-label text-ink-subtle">{label}</p>
      {children}
    </div>
  );
}

function Swatches({ theme, title }: { theme: 'light' | 'dark'; title: string }) {
  return (
    <div data-theme={theme} className="rounded-lg border border-border bg-canvas p-4 text-ink">
      <p className="type-label mb-3 text-ink-subtle">{title}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COLOR_TOKENS.map((token) => (
          <li key={token} className="flex items-center gap-2">
            <span className="size-8 shrink-0 rounded-md border border-border-strong" style={{ backgroundColor: `var(--${token})` }} />
            <code className="text-xs">{token}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function StyleguidePage() {
  if (!enabled()) notFound();
  const t = await getTranslations('styleguide');
  const paging = (n: number) => `/styleguide?page=${n}#pagination`;

  return (
    <main className="mx-auto max-w-page space-y-10 px-gutter py-8">
      <header className="space-y-2">
        <h1 className="type-display">{t('title')}</h1>
        <p className="type-lede max-w-content text-ink-muted">{t('intro')}</p>
        <nav aria-label={t('toc')} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {(['fonts', 'type', 'colors', 'spacing', 'articles', 'people', 'badges', 'navigation', 'sources', 'dark'] as const).map((id) => (
            <a key={id} href={`#${id}`} className="text-link underline underline-offset-2">
              {t(`sections.${id}`)}
            </a>
          ))}
        </nav>
      </header>

      <Section id="fonts" title={t('sections.fonts')} note={t('notes.fonts')}>
        <div className="grid gap-6 md:grid-cols-2">
          <Specimen label="Source Serif 4 — 400 / 600 / 700">
            <p className="font-serif text-2xl">{PANGRAM}</p>
            <p className="font-serif text-xl font-semibold">{ALPHABET_UPPER}</p>
            <p className="font-serif text-xl font-bold">{ALPHABET_LOWER}</p>
          </Specimen>
          <Specimen label="Inter — 400 / 500 / 600 / 700">
            <p className="font-sans text-xl">{PANGRAM}</p>
            <p className="font-sans text-lg font-medium">{ALPHABET_UPPER}</p>
            <p className="font-sans text-lg font-semibold">{ALPHABET_LOWER}</p>
            <p className="font-sans text-lg font-bold">{GLYPH_LINE}</p>
          </Specimen>
        </div>
      </Section>

      <Section id="type" title={t('sections.type')} note={t('notes.type')}>
        <ul className="space-y-5">
          {TYPE_SAMPLES.map((sample) => (
            <li key={sample.utility} className="space-y-1">
              <code className="text-xs text-ink-subtle">.{sample.utility}</code>
              <p className={sample.utility}>{sample.text}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="colors" title={t('sections.colors')} note={t('notes.colors')}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Swatches theme="light" title={t('light')} />
          <Swatches theme="dark" title={t('dark')} />
        </div>
      </Section>

      <Section id="spacing" title={t('sections.spacing')} note={t('notes.spacing')}>
        <ul className="space-y-2">
          {SPACING_STEPS.map((step) => (
            <li key={step} className="flex items-center gap-3">
              <code className="w-16 text-xs text-ink-subtle">
                {step} · {step * 4}px
              </code>
              <span className="h-3 rounded-sm bg-accent" style={{ width: `calc(var(--spacing) * ${step})` }} />
            </li>
          ))}
        </ul>
      </Section>

      <Section id="articles" title={t('sections.articles')} note={t('notes.articles')}>
        <Specimen label={t('variants.lead')}>
          <ArticleCard article={ARTICLES[0]!} size="lead" priority headingLevel={3} />
        </Specimen>
        <Specimen label={t('variants.standard')}>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {ARTICLES.slice(1, 4).map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </Specimen>
        <Specimen label={t('variants.compact')}>
          <div className="max-w-content divide-y divide-border">
            {ARTICLES.slice(1).map((article) => (
              <ArticleCard key={article.id} article={article} size="compact" />
            ))}
          </div>
        </Specimen>
        <Specimen label={t('variants.related')}>
          <div className="max-w-content">
            <RelatedArticles articles={ARTICLES.slice(1, 5)} />
          </div>
        </Specimen>
        <Specimen label={t('variants.relatedLoading')}>
          <div className="max-w-content">
            <RelatedArticlesSkeleton />
          </div>
        </Specimen>
      </Section>

      <Section id="people" title={t('sections.people')} note={t('notes.people')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PEOPLE.map((person) => (
            <PersonCard key={person.slug} person={person} />
          ))}
        </div>
      </Section>

      <Section id="badges" title={t('sections.badges')} note={t('notes.badges')}>
        <Specimen label="PartyBadge">
          <div className="flex flex-wrap gap-2">
            {PARTIES.map((party) => (
              <PartyBadge key={party.slug} party={party} />
            ))}
          </div>
        </Specimen>
        <Specimen label="Tag">
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <Tag key={tag.slug} tag={tag} />
            ))}
          </div>
        </Specimen>
      </Section>

      <Section id="navigation" title={t('sections.navigation')} note={t('notes.navigation')}>
        <Specimen label="Breadcrumbs">
          <Breadcrumbs items={CRUMBS} />
        </Specimen>
        <div id="pagination" className="scroll-mt-20 space-y-4">
          {(
            [
              [1, 12],
              [6, 12],
              [12, 12],
              [2, 3],
            ] as const
          ).map(([page, total]) => (
            <Specimen key={`${page}-${total}`} label={`Pagination — ${page} / ${total}`}>
              <Pagination page={page} totalPages={total} hrefFor={paging} />
            </Specimen>
          ))}
        </div>
      </Section>

      <Section id="sources" title={t('sections.sources')} note={t('notes.sources')}>
        <Specimen label={t('variants.inlineSource')}>
          <SourceLink href={SOURCE_URL} />
        </Specimen>
        <Specimen label={t('variants.iconSource')}>
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-3 text-sm">
            <span className="flex-1">{t('sampleFact')}</span>
            <SourceLink href={SOURCE_URL} variant="icon" />
          </div>
        </Specimen>
        <Specimen label="CorrectionNotice">
          <div className="max-w-content space-y-4">
            <CorrectionNotice corrections={CORRECTIONS.slice(0, 1)} />
            <CorrectionNotice corrections={CORRECTIONS} />
          </div>
        </Specimen>
      </Section>

      <Section id="dark" title={t('sections.dark')} note={t('notes.dark')}>
        <div data-theme="dark" className="space-y-6 rounded-lg border border-border bg-canvas p-4 text-ink sm:p-6">
          <ArticleCard article={ARTICLES[0]!} size="lead" />
          <div className="grid gap-3 sm:grid-cols-2">
            {PEOPLE.slice(0, 2).map((person) => (
              <PersonCard key={person.slug} person={person} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {PARTIES.map((party) => (
              <PartyBadge key={party.slug} party={party} />
            ))}
            {TAGS.slice(0, 2).map((tag) => (
              <Tag key={tag.slug} tag={tag} />
            ))}
          </div>
          <SourceLink href={SOURCE_URL} />
          <CorrectionNotice corrections={CORRECTIONS.slice(0, 1)} />
          <Pagination page={6} totalPages={12} hrefFor={paging} />
        </div>
      </Section>
    </main>
  );
}
