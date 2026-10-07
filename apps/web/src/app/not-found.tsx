import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { routes } from '@/lib/routes';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <main className="mx-auto max-w-content space-y-4 px-gutter py-16 text-center">
      <h1 className="type-headline">{t('title')}</h1>
      <p className="text-ink-muted">{t('body')}</p>
      <Link href={routes.home} className="inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-medium text-accent-ink">
        {t('home')}
      </Link>
    </main>
  );
}
