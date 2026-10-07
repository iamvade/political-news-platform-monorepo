import Link from 'next/link';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { pageRange } from '@/lib/pagination';
import { ChevronLeftIcon, ChevronRightIcon } from './icons';

interface PaginationProps {
  page: number;
  totalPages: number;
  /** URL of a page, e.g. (n) => `/section/politics?page=${n}`. */
  hrefFor: (page: number) => string;
}

const BOX = 'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm';

/** Prev/next with "3 / 12" on phones; page numbers with gaps from `sm`. Renders nothing for a single page. */
export function Pagination({ page, totalPages, hrefFor }: PaginationProps) {
  const t = useTranslations('pagination');
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  const edge = (target: number | null, label: string, icon: ReactNode, side: 'prev' | 'next') =>
    target ? (
      <Link href={hrefFor(target)} rel={side} className={`${BOX} gap-1 border border-border bg-surface font-medium text-ink hover:border-border-strong`}>
        {side === 'prev' && icon}
        {label}
        {side === 'next' && icon}
      </Link>
    ) : (
      <span aria-disabled="true" className={`${BOX} gap-1 border border-border text-ink-subtle opacity-60`}>
        {side === 'prev' && icon}
        {label}
        {side === 'next' && icon}
      </span>
    );

  return (
    <nav aria-label={t('label')} className="flex items-center justify-between gap-2">
      {edge(prev, t('previous'), <ChevronLeftIcon className="size-4" />, 'prev')}
      <p className="text-sm text-ink-muted sm:hidden">{t('pageOf', { page, total: totalPages })}</p>
      <ol className="hidden items-center gap-1 sm:flex">
        {pageRange(page, totalPages).map((item, index) =>
          item === 'gap' ? (
            <li key={`gap-${index}`} aria-hidden className="px-1 text-ink-subtle">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={hrefFor(item)}
                aria-current={item === page ? 'page' : undefined}
                aria-label={t('page', { page: item })}
                className={`${BOX} tabular-nums ${item === page ? 'bg-accent font-semibold text-accent-ink' : 'text-ink-muted hover:bg-surface-muted hover:text-ink'}`}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      {edge(next, t('next'), <ChevronRightIcon className="size-4" />, 'next')}
    </nav>
  );
}
