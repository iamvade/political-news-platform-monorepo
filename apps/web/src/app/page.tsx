import { isApiError } from '@news/shared/api-client';
import { getTranslations } from 'next-intl/server';
import { getApi } from '@/lib/api';

// Status page: always render fresh. Real content pages will use ISR + revalidateTag.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const t = await getTranslations('home');

  let status: string;
  try {
    await getApi().health.ready({ init: { cache: 'no-store' } });
    status = t('ok');
  } catch (err) {
    status = t('error', { code: isApiError(err) ? err.code : 'UNKNOWN' });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t('heading')}</h1>
      <p className="mt-4 text-neutral-600">
        {t('apiStatus')}: {status}
      </p>
    </main>
  );
}
