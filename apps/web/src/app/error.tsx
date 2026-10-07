'use client';

import { useTranslations } from 'next-intl';

/** Rendering failed (API down after the cache expired): say so and offer a retry. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <main className="mx-auto max-w-content space-y-4 px-gutter py-16 text-center">
      <h1 className="type-headline">{t('title')}</h1>
      <p className="text-ink-muted">{t('body')}</p>
      <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-medium text-accent-ink">
        {t('retry')}
      </button>
    </main>
  );
}
