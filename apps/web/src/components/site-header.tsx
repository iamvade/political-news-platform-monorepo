import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';
import { SearchIcon } from './icons';
import { MobileMenu } from './mobile-menu';
import { NavLinks } from './nav-links';
import { ThemeToggle } from './theme-toggle';

/** Sticky, compact site header: wordmark, main navigation (menu on phones), search and theme toggle. */
export function SiteHeader() {
  const t = useTranslations();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="relative mx-auto flex h-14 max-w-page items-center gap-2 px-gutter">
        <MobileMenu />
        <Link href={routes.home} className="mr-auto font-serif text-xl font-bold tracking-tight text-ink md:mr-6">
          {t('site.name')}
        </Link>
        <nav aria-label={t('nav.label')} className="mr-auto hidden md:block">
          <NavLinks layout="bar" />
        </nav>
        <Link
          href={routes.search}
          aria-label={t('nav.search')}
          className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <SearchIcon className="size-5" />
        </Link>
        <ThemeToggle />
      </div>
      <div aria-hidden className="h-0.5 bg-accent" />
    </header>
  );
}
