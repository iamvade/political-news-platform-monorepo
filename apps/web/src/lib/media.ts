import type { PublicArticleSummary } from '@news/shared/schemas';

export type PublicMedia = NonNullable<PublicArticleSummary['cover']>;

/** `src` + `srcSet` from the WebP variants (smallest first), or null when the media has no public URL yet. */
export function imageSources(media: PublicMedia): { src: string; srcSet: string | undefined } | null {
  const variants = media.variants.filter((v): v is typeof v & { url: string } => v.url !== null);
  const src = media.url ?? variants.at(-1)?.url;
  if (!src) return null;
  return { src, srcSet: variants.length > 1 ? variants.map((v) => `${v.url} ${v.width}w`).join(', ') : undefined };
}
