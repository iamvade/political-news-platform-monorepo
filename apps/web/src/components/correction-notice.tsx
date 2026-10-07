import type { PublicArticle } from '@news/shared/schemas';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';
import { NoticeIcon } from './icons';

export type Correction = PublicArticle['corrections'][number];

/** Visible correction note on an article or profile (PRD §10.2): what changed, why and when. */
export function CorrectionNotice({ corrections }: { corrections: Correction[] }) {
  const t = useTranslations('correction');
  const format = useFormatter();
  if (corrections.length === 0) return null;
  const sorted = [...corrections].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <aside role="note" aria-labelledby="correction-title" className="rounded-md border border-notice-border border-l-4 bg-notice-bg p-4 text-notice-ink">
      <p id="correction-title" className="flex items-center gap-2 font-semibold">
        <NoticeIcon className="size-5 shrink-0" />
        {t(corrections.length === 1 ? 'titleOne' : 'titleMany', { count: corrections.length })}
      </p>
      <ul className="mt-2 space-y-3">
        {sorted.map((correction, index) => (
          <li key={`${correction.date}-${index}`} className="text-sm">
            <time dateTime={correction.date} className="type-meta font-medium">
              {format.dateTime(new Date(`${correction.date}T00:00:00Z`), { dateStyle: 'long', timeZone: 'UTC' })}
            </time>
            <p className="mt-0.5">{correction.description}</p>
            <p className="mt-0.5 opacity-90">{t('reason', { reason: correction.reason })}</p>
          </li>
        ))}
      </ul>
      <Link href={routes.corrections} className="mt-3 inline-block text-sm font-medium underline underline-offset-2">
        {t('allCorrections')}
      </Link>
    </aside>
  );
}
