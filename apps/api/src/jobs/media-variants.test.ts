import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../app';
import { media } from '../db/schema/index';
import { buildTestApp } from '../test/app';
import { makeJpeg } from '../test/images';
import { createMemoryStorage } from '../test/memory-storage';
import { resetDb } from '../test/reset-db';
import { processMediaVariants, variantWidths, type MediaProcessorDeps } from './processors/media-variants';

const storage = createMemoryStorage();
let app: App;
let deps: MediaProcessorDeps;

beforeAll(async () => {
  app = await buildTestApp({ storage });
  deps = { db: app.db, storage: app.storage, log: { info: () => {}, warn: () => {} } };
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  storage.reset();
});

/** A media row in `processing` with its original already in the (fake) originals bucket. */
async function uploaded(body: Uint8Array, mime = 'image/jpeg') {
  const key = `originals/test/${Math.random().toString(36).slice(2)}.jpg`;
  storage.upload('test-originals', key, body, mime);
  const [row] = await app.db.insert(media).values({ r2Key: key, mime, byteSize: body.length, status: 'processing' }).returning();
  return row!;
}

async function rowOf(id: number) {
  const [row] = await app.db.select().from(media).where(eq(media.id, id));
  return row!;
}

describe('variantWidths', () => {
  it.each([
    [2000, [320, 640, 1024, 1600]],
    [1600, [320, 640, 1024, 1600]],
    [1200, [320, 640, 1024]],
    [500, [320]],
    [200, [200]],
  ])('%i px wide → %j', (width, expected) => {
    expect(variantWidths(width)).toEqual(expected);
  });
});

describe('processMediaVariants', () => {
  it('writes four WebP variants to the public bucket, strips EXIF/GPS, and marks ready', async () => {
    const row = await uploaded(await makeJpeg(2000, 1000, { gps: true }));
    expect((await sharp(storage.objects.get(`test-originals/${row.r2Key}`)!.body).metadata()).exif).toBeDefined();

    const outcome = await processMediaVariants(deps, { mediaId: row.id });

    expect(outcome).toBe('ready');
    const after = await rowOf(row.id);
    expect(after).toMatchObject({ status: 'ready', width: 2000, height: 1000, processingError: null });
    expect(Object.keys(after.variants).sort()).toEqual(['w1024', 'w1600', 'w320', 'w640']);
    for (const [width, height] of [[320, 160], [640, 320], [1024, 512], [1600, 800]] as const) {
      const variant = after.variants[`w${width}`]!;
      expect(variant).toMatchObject({ key: `media/${row.id}/w${width}.webp`, width, height });
      const stored = storage.objects.get(`test-public/${variant.key}`)!;
      expect(stored.contentType).toBe('image/webp');
      expect(stored.cacheControl).toBe('public, max-age=31536000, immutable');
      const meta = await sharp(stored.body).metadata();
      expect(meta).toMatchObject({ format: 'webp', width, height });
      expect(meta.exif).toBeUndefined();
    }
    // Nothing generated lands in the originals bucket.
    expect([...storage.objects.keys()].filter((k) => k.startsWith('test-originals/'))).toEqual([`test-originals/${row.r2Key}`]);
  });

  it('applies EXIF orientation (portrait photo shot sideways)', async () => {
    const row = await uploaded(await makeJpeg(2000, 1000, { orientation: 6 }));

    await processMediaVariants(deps, { mediaId: row.id });

    const after = await rowOf(row.id);
    expect(after).toMatchObject({ width: 1000, height: 2000 });
    expect(after.variants.w320).toMatchObject({ width: 320, height: 640 });
    expect(Object.keys(after.variants).sort()).toEqual(['w320', 'w640']);
  });

  it('does not upscale small images', async () => {
    const small = await uploaded(await makeJpeg(500, 250));
    const tiny = await uploaded(await makeJpeg(200, 100));

    await processMediaVariants(deps, { mediaId: small.id });
    await processMediaVariants(deps, { mediaId: tiny.id });

    expect(Object.keys((await rowOf(small.id)).variants)).toEqual(['w320']);
    expect((await rowOf(tiny.id)).variants).toEqual({ w200: expect.objectContaining({ width: 200, height: 100 }) });
  });

  it('marks undecodable files failed without retrying', async () => {
    const row = await uploaded(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 6, 7, 8]));

    const outcome = await processMediaVariants(deps, { mediaId: row.id });

    expect(outcome).toBe('failed');
    expect(await rowOf(row.id)).toMatchObject({ status: 'failed', processingError: expect.stringContaining('Could not process image') });
  });

  it('throws (so BullMQ retries) when the original cannot be read from storage', async () => {
    const [row] = await app.db.insert(media).values({ r2Key: 'originals/missing.jpg', mime: 'image/jpeg', status: 'processing' }).returning();

    await expect(processMediaVariants(deps, { mediaId: row!.id })).rejects.toThrow();
    expect((await rowOf(row!.id)).status).toBe('processing');
  });

  it('is idempotent: ready, pending and deleted media are skipped', async () => {
    const row = await uploaded(await makeJpeg(800, 400));
    await processMediaVariants(deps, { mediaId: row.id });
    const writes = storage.objects.size;

    const [pending] = await app.db.insert(media).values({ r2Key: 'originals/p.jpg', mime: 'image/jpeg', status: 'pending' }).returning();

    expect(await processMediaVariants(deps, { mediaId: row.id })).toBe('skipped');
    expect(await processMediaVariants(deps, { mediaId: pending!.id })).toBe('skipped');
    expect(await processMediaVariants(deps, { mediaId: 999_999 })).toBe('skipped');
    expect(storage.objects.size).toBe(writes);
  });
});
