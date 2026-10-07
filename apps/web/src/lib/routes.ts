/** Public URLs (PRD §7). Latin slug + numeric id where the id is canonical. */
export const routes = {
  home: '/',
  people: '/people',
  parliament: '/parliament',
  cabinet: '/cabinet',
  search: '/search',
  corrections: '/corrections',
  reply: '/reply',
  contact: '/contact',
  about: '/about',
  editorialPolicy: '/about/editorial-policy',
  methodology: '/about/methodology',
  ownership: '/about/ownership',
  privacy: '/about/privacy',
  terms: '/about/terms',
  article: (article: { id: number; slug: string }) => `/news/${article.id}-${article.slug}`,
  person: (person: { id: number; slug: string }) => `/person/${person.id}-${person.slug}`,
  party: (slug: string) => `/party/${slug}`,
  tag: (slug: string) => `/tag/${slug}`,
  section: (slug: string) => `/section/${slug}`,
} as const;

/** `42-ikh-khural-tosov` → `{ id: 42, slug: 'ikh-khural-tosov' }`; null if the segment is not `{id}-{slug}`. */
export function parseIdSlug(segment: string): { id: number; slug: string } | null {
  const match = /^(\d{1,15})-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(segment);
  if (!match) return null;
  const id = Number(match[1]);
  return id > 0 ? { id, slug: match[2]! } : null;
}
