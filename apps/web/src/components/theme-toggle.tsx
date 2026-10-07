'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { NEXT_THEME, applyTheme, readTheme, subscribeTheme, type ThemePreference } from '@/lib/theme';
import { AutoThemeIcon, MoonIcon, SunIcon } from './icons';

const ICONS: Record<ThemePreference, typeof SunIcon> = { auto: AutoThemeIcon, light: SunIcon, dark: MoonIcon };

/** Cycles auto → light → dark. "auto" follows the phone setting. */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const current = useSyncExternalStore(subscribeTheme, readTheme, () => 'auto' as const);
  const next = NEXT_THEME[current];
  const Icon = ICONS[current];
  const label = t('toggle', { current: t(`modes.${current}`), next: t(`modes.${next}`) });

  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={label}
      title={label}
      className="inline-flex size-11 items-center justify-center rounded-md text-ink-muted hover:bg-surface-muted hover:text-ink"
    >
      <Icon className="size-5" />
    </button>
  );
}
