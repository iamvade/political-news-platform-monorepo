import type { AdminMedia } from '@news/shared/schemas';

/** The largest variant no wider than `maxWidth` (variants are smallest first), else the smallest one. */
export function variantUrl(media: Pick<AdminMedia, 'variants'>, maxWidth: number): string | null {
  const fitting = media.variants.filter((v) => v.width <= maxWidth && v.url);
  return (fitting.at(-1) ?? media.variants[0])?.url ?? null;
}

export const thumbnailUrl = (media: Pick<AdminMedia, 'variants'>) => variantUrl(media, 320);
