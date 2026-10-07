import { useTranslations } from 'next-intl';
import { ExternalLinkIcon, SourceIcon } from './icons';

/** `parliament.mn` from a URL (null if it does not parse). */
export function sourceHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

interface SourceLinkProps {
  href: string;
  /** `inline`: icon + "Эх сурвалж · host"; `icon`: compact icon next to a data block. */
  variant?: 'inline' | 'icon';
}

/** Link to the primary source of a fact (PRD §10.1). Opens in a new tab; the host is always visible or announced. */
export function SourceLink({ href, variant = 'inline' }: SourceLinkProps) {
  const t = useTranslations('source');
  const host = sourceHost(href) ?? href;
  const common = { href, target: '_blank', rel: 'noopener noreferrer' } as const;

  if (variant === 'icon') {
    return (
      <a
        {...common}
        aria-label={t('iconLabel', { host })}
        title={t('iconLabel', { host })}
        className="inline-flex size-8 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-muted hover:text-link"
      >
        <SourceIcon className="size-4" />
      </a>
    );
  }
  return (
    <a {...common} className="inline-flex items-center gap-1.5 text-sm text-link underline decoration-1 underline-offset-2 hover:decoration-2">
      <SourceIcon className="size-4 shrink-0" />
      <span>
        {t('label')} · {host}
      </span>
      <ExternalLinkIcon className="size-3.5 shrink-0" />
      <span className="sr-only">{t('newWindow')}</span>
    </a>
  );
}
