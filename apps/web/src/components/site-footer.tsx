import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { routes } from '@/lib/routes';

const GROUPS = [
  { key: 'trust', links: ['editorialPolicy', 'methodology', 'ownership', 'corrections'] },
  { key: 'contact', links: ['reply', 'contact', 'about'] },
  { key: 'legal', links: ['privacy', 'terms'] },
] as const;

/** Footer with the trust pages (PRD §10): policy, methodology, ownership, corrections, right of reply. */
export function SiteFooter() {
  const t = useTranslations();
  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-page gap-8 px-gutter py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="font-serif text-lg font-bold text-ink">{t('site.name')}</p>
          <p className="text-sm text-ink-muted">{t('site.tagline')}</p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.key} aria-label={t(`footer.groups.${group.key}`)}>
            <p className="type-label text-ink-subtle">{t(`footer.groups.${group.key}`)}</p>
            <ul className="mt-3 space-y-1">
              {group.links.map((link) => (
                <li key={link}>
                  <Link href={routes[link]} className="inline-flex min-h-9 items-center text-sm text-ink-muted hover:text-ink hover:underline">
                    {t(`footer.links.${link}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-page px-gutter py-4 type-meta text-ink-subtle">{t('footer.copyright', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
