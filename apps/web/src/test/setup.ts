import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// next/navigation needs the App Router; components only read the pathname.
const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

// `server-only` throws outside React Server Components; tests import server modules directly.
vi.mock('server-only', () => ({}));

/** Change what `usePathname()` returns in a test. */
export function setPathname(pathname: string) {
  navigation.pathname = pathname;
}

afterEach(() => {
  navigation.pathname = '/';
  // Some tests (tokens) run in the node environment.
  if (typeof window === 'undefined') return;
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
