import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRightIcon } from './icons';

export interface Crumb {
  label: string;
  /** Omit for the current page (always the last crumb). */
  href?: string;
}

/** Where the page sits in the site. The last crumb is the current page; long labels truncate on phones. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const t = useTranslations('breadcrumbs');
  return (
    <nav aria-label={t('label')} className="type-meta text-ink-subtle">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRightIcon className="size-3.5 shrink-0" />}
              {last || !item.href ? (
                <span aria-current={last ? 'page' : undefined} className="max-w-[16rem] truncate text-ink-muted sm:max-w-none">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="truncate hover:text-ink hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
