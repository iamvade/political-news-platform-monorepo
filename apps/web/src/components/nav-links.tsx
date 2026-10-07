'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';

export const NAV_ITEMS = [
  { key: 'news', href: routes.home },
  { key: 'people', href: routes.people },
  { key: 'parliament', href: routes.parliament },
  { key: 'cabinet', href: routes.cabinet },
] as const;

const isActive = (pathname: string, href: string) => {
  if (href === '/') return pathname === '/' || pathname.startsWith('/news/');
  if (href === '/people') return pathname.startsWith('/people') || pathname.startsWith('/person/');
  return pathname.startsWith(href);
};

/** Main navigation links; marks the current section with aria-current. */
export function NavLinks({ layout }: { layout: 'bar' | 'stack' }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <ul className={layout === 'bar' ? 'flex items-center gap-1' : 'flex flex-col'}>
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={
                layout === 'bar'
                  ? 'inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink-muted hover:text-ink aria-[current=page]:text-ink aria-[current=page]:underline aria-[current=page]:decoration-2 aria-[current=page]:underline-offset-8'
                  : 'flex min-h-12 items-center border-b border-border px-gutter text-base font-medium text-ink aria-[current=page]:font-bold'
              }
            >
              {t(item.key)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
