import type { media, MediaVariants } from '../db/schema/index';

type MediaRow = Pick<typeof media.$inferSelect, 'status' | 'alt' | 'credit' | 'width' | 'height' | 'variants'>;

export interface MediaVariantDto {
  width: number;
  height: number;
  url: string | null;
}

export interface PublicMedia {
  url: string | null;
  variants: MediaVariantDto[];
  alt: string | null;
  credit: string | null;
  width: number | null;
  height: number | null;
}

/** Preferred width for the single `url` (cards, OG fallbacks); `variants` covers srcset. */
const DEFAULT_WIDTH = 1024;

export function publicUrl(baseUrl: string | undefined, key: string): string | null {
  return baseUrl ? `${baseUrl.replace(/\/+$/, '')}/${key}` : null;
}

/** WebP variants in the public bucket, smallest first. */
export function variantList(variants: MediaVariants, baseUrl: string | undefined): MediaVariantDto[] {
  return Object.values(variants)
    .map((v) => ({ width: v.width, height: v.height, url: publicUrl(baseUrl, v.key) }))
    .sort((a, b) => a.width - b.width);
}

/**
 * Public media DTO, built from the generated variants only (originals are private).
 * Media that is not `ready` is not exposed.
 */
export function toPublicMedia(row: MediaRow | null | undefined, baseUrl: string | undefined): PublicMedia | null {
  if (!row || row.status !== 'ready') return null;
  const variants = variantList(row.variants, baseUrl);
  if (variants.length === 0) return null;
  const preferred = [...variants].reverse().find((v) => v.width <= DEFAULT_WIDTH) ?? variants[0]!;
  return { url: preferred.url, variants, alt: row.alt, credit: row.credit, width: row.width, height: row.height };
}
