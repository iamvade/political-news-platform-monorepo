import type { MediaMimeType } from '@news/shared/schemas';

export const MIME_EXTENSIONS: Record<MediaMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

/** How many leading bytes `detectImageType` needs. */
export const SNIFF_BYTES = 32;

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));

/**
 * Identifies an allowed image type from its magic bytes, independent of the declared Content-Type.
 * Returns null for anything else (HTML, SVG, executables, HEIC, GIF, ...).
 */
export function detectImageType(bytes: Uint8Array): MediaMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    // ISO-BMFF: major brand at 8..12, compatible brands follow (4 bytes each) up to the box size.
    const boxSize = Math.min(bytes.length, (bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!);
    for (let offset = 8; offset + 4 <= boxSize; offset += 4) {
      if (offset === 12) continue; // minor version, not a brand
      const brand = ascii(bytes, offset, offset + 4);
      if (brand === 'avif' || brand === 'avis') return 'image/avif';
    }
  }
  return null;
}
