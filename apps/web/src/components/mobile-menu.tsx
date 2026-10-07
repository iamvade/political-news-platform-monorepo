'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CloseIcon, MenuIcon } from './icons';
import { NavLinks } from './nav-links';

/**
 * Phone navigation as a native <details> disclosure: opens without JavaScript. Keyed by the pathname so
 * it closes after a client-side navigation (the header stays mounted between pages).
 */
export function MobileMenu() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  return (
    <details key={pathname} className="group md:hidden">
      <summary
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md text-ink hover:bg-surface-muted [&::-webkit-details-marker]:hidden"
        aria-label={t('menu')}
      >
        <MenuIcon className="size-6 group-open:hidden" />
        <CloseIcon className="hidden size-6 group-open:block" />
      </summary>
      <nav aria-label={t('label')} className="absolute inset-x-0 top-full border-b border-border bg-surface shadow-sm">
        <NavLinks layout="stack" />
      </nav>
    </details>
  );
}
