import type { UserRole } from '@news/shared/schemas';

export type SectionKey = 'articles' | 'persons' | 'organizations' | 'bills' | 'media' | 'homepage' | 'users';

export interface Section {
  key: SectionKey;
  path: string;
  /** Roles that may open the section. Mirrors the API's requireRole (Homepage/Users: PRD, no API yet). */
  roles: readonly UserRole[];
}

/** Single source of truth for the sidebar menu and the route guards. */
export const SECTIONS: readonly Section[] = [
  { key: 'articles', path: '/articles', roles: ['reporter', 'editor', 'admin'] },
  { key: 'persons', path: '/persons', roles: ['data_editor', 'admin'] },
  { key: 'organizations', path: '/organizations', roles: ['data_editor', 'admin'] },
  { key: 'bills', path: '/bills', roles: ['data_editor', 'admin'] },
  { key: 'media', path: '/media', roles: ['reporter', 'editor', 'admin', 'data_editor'] },
  { key: 'homepage', path: '/homepage', roles: ['editor', 'admin'] },
  { key: 'users', path: '/users', roles: ['admin'] },
];

export function canAccess(role: UserRole, key: SectionKey): boolean {
  return SECTIONS.some((section) => section.key === key && section.roles.includes(role));
}

export function visibleSections(role: UserRole): Section[] {
  return SECTIONS.filter((section) => section.roles.includes(role));
}

/** Where to land after login or on `/`. */
export function defaultPath(role: UserRole): string {
  return visibleSections(role)[0]?.path ?? '/media';
}

/** Only same-app paths are allowed as `?next=` (no open redirects). */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
  if (next === '/login' || next.startsWith('/login?')) return null;
  return next;
}
