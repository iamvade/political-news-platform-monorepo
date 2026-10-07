import { MEDIA_VARIANT_WIDTHS } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import sharp from 'sharp';
import type { Db } from '../../db/client';
import { media, type MediaVariants } from '../../db/schema/index';
import type { MediaStorage } from '../../plugins/storage';
import type { MediaJobData } from '../types';

export interface MediaProcessorDeps {
  db: Db;
  storage: MediaStorage | null;
  log: Pick<FastifyBaseLogger, 'info' | 'warn'>;
}

/** Refuse decompression bombs: ~100 megapixels is far above any newsroom photo. */
const LIMIT_INPUT_PIXELS = 100_000_000;
const WEBP_QUALITY = 80;
const VARIANT_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** EXIF orientations 5–8 rotate by 90°, swapping width and height. */
const swapsAxes = (orientation: number | undefined) => orientation !== undefined && orientation >= 5;

/** Target widths no wider than the original; a tiny original gets one variant at its own width. */
export function variantWidths(originalWidth: number): number[] {
  const widths = MEDIA_VARIANT_WIDTHS.filter((w) => w <= originalWidth);
  return widths.length ? [...widths] : [originalWidth];
}

class UnprocessableImage extends Error {}

async function renderVariants(input: Uint8Array) {
  try {
    const metadata = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS }).metadata();
    if (!metadata.width || !metadata.height) throw new UnprocessableImage('Image has no dimensions');
    const width = swapsAxes(metadata.orientation) ? metadata.height : metadata.width;
    const height = swapsAxes(metadata.orientation) ? metadata.width : metadata.height;

    const outputs = [];
    for (const target of variantWidths(width)) {
      // .rotate() applies EXIF orientation; sharp writes no metadata by default, so EXIF/GPS is stripped.
      const { data, info } = await sharp(input, { limitInputPixels: LIMIT_INPUT_PIXELS })
        .rotate()
        .resize({ width: target, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      outputs.push({ data, width: info.width, height: info.height });
    }
    return { width, height, outputs };
  } catch (err) {
    if (err instanceof UnprocessableImage) throw err;
    throw new UnprocessableImage(err instanceof Error ? err.message : String(err));
  }
}

/**
 * Generates WebP variants for an uploaded original. Idempotent: ready/deleted/missing media is skipped.
 * Undecodable images are marked failed immediately; storage errors throw so BullMQ retries.
 */
export async function processMediaVariants(
  deps: MediaProcessorDeps,
  data: MediaJobData,
): Promise<'ready' | 'skipped' | 'failed'> {
  const [row] = await deps.db.select().from(media).where(eq(media.id, data.mediaId)).limit(1);
  if (!row || row.deletedAt || row.status === 'ready' || row.status === 'pending') return 'skipped';
  if (!deps.storage) throw new Error('Media storage is not configured');
  const { client, originalsBucket, publicBucket } = deps.storage;

  const input = await client.getObject(originalsBucket, row.r2Key);

  let rendered: Awaited<ReturnType<typeof renderVariants>>;
  try {
    rendered = await renderVariants(input);
  } catch (err) {
    if (!(err instanceof UnprocessableImage)) throw err;
    await markFailed(deps.db, row.id, `Could not process image: ${err.message}`);
    deps.log.warn({ mediaId: row.id, err: err.message }, 'Media marked failed (undecodable image)');
    return 'failed';
  }

  const variants: MediaVariants = {};
  for (const output of rendered.outputs) {
    const key = `media/${row.id}/w${output.width}.webp`;
    await client.putObject(publicBucket, key, output.data, { contentType: 'image/webp', cacheControl: VARIANT_CACHE_CONTROL });
    variants[`w${output.width}`] = { key, width: output.width, height: output.height, bytes: output.data.length, mime: 'image/webp' };
  }

  await deps.db
    .update(media)
    .set({ status: 'ready', width: rendered.width, height: rendered.height, variants, processingError: null })
    .where(eq(media.id, row.id));
  deps.log.info({ mediaId: row.id, variants: Object.keys(variants) }, 'Media variants ready');
  return 'ready';
}

export async function markFailed(db: Db, mediaId: number, reason: string): Promise<void> {
  await db.update(media).set({ status: 'failed', processingError: reason.slice(0, 1000) }).where(eq(media.id, mediaId));
}
