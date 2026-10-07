/** Mongolian (and Russian) Cyrillic → ASCII, tuned for URL slugs (ө→o, ү→u). Not a search transliteration. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'i', к: 'k',
  л: 'l', м: 'm', н: 'n', о: 'o', ө: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ү: 'u', ф: 'f',
  х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'y', ь: 'i', э: 'e', ю: 'yu', я: 'ya',
};

export const SLUG_MAX_LENGTH = 80;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(input: string, fallback = 'article'): string {
  const latin = Array.from(input.toLowerCase())
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('')
    // Strip accents from Latin letters (é → e).
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '');

  let slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > SLUG_MAX_LENGTH) {
    slug = slug.slice(0, SLUG_MAX_LENGTH);
    const lastDash = slug.lastIndexOf('-');
    if (lastDash > SLUG_MAX_LENGTH / 2) slug = slug.slice(0, lastDash);
    slug = slug.replace(/-+$/, '');
  }
  return slug || fallback;
}
