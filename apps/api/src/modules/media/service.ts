import { randomUUID } from 'node:crypto';
import {
  ErrorCode,
  type AdminMedia,
  type AuthUser,
  type MediaMimeType,
  type RequestUploadBody,
  type UpdateMediaBody,
  type mediaListQuerySchema,
} from '@news/shared/schemas';
import { and, count, desc, eq, ilike, isNull, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db/client';
import { articles, media } from '../../db/schema/index';
import type { Jobs } from '../../jobs/types';
import { audit } from '../../lib/audit';
import { assertHasChanges, diffOf, iso, likePattern, notFound } from '../../lib/crud';
import { AppError } from '../../lib/errors';
import { variantList } from '../../lib/media';
import type { MediaStorage } from '../../plugins/storage';
import { detectImageType, MIME_EXTENSIONS, SNIFF_BYTES } from './validation';

type MediaRow = typeof media.$inferSelect;

export interface MediaDeps {
  db: Db;
  storage: MediaStorage | null;
  jobs: Jobs;
  maxBytes: number;
  publicBaseUrl: string | undefined;
  log: { error: (obj: object, msg: string) => void };
}

const UPLOAD_URL_TTL_SECONDS = 10 * 60;

export function toAdminMedia(row: MediaRow, publicBaseUrl: string | undefined): AdminMedia {
  return {
    id: row.id,
    status: row.status,
    mime: row.mime,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
    originalFilename: row.originalFilename,
    alt: row.alt,
    credit: row.credit,
    processingError: row.processingError,
    uploadedBy: row.uploadedBy,
    variants: variantList(row.variants, publicBaseUrl),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

function requireStorage(storage: MediaStorage | null): MediaStorage {
  if (!storage) throw new AppError(503, ErrorCode.SERVICE_UNAVAILABLE, 'Media storage is not configured');
  return storage;
}

/** Empty strings count as "not provided". */
const blankToNull = (value: string | null | undefined) => (value === undefined ? undefined : value?.trim() ? value.trim() : null);

async function findMedia(db: Db, id: number): Promise<MediaRow> {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), isNull(media.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Media');
  return row;
}

// ---------------------------------------------------------------------------------------------------------------
// Upload: presign → (browser PUT) → confirm
// ---------------------------------------------------------------------------------------------------------------

export async function requestUpload(deps: MediaDeps, user: AuthUser, body: RequestUploadBody) {
  const storage = requireStorage(deps.storage);
  if (body.byteSize > deps.maxBytes) {
    throw new AppError(400, ErrorCode.MEDIA_TOO_LARGE, `File is ${body.byteSize} bytes; the maximum is ${deps.maxBytes}`);
  }

  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const key = `originals/${now.getUTCFullYear()}/${month}/${randomUUID()}.${MIME_EXTENSIONS[body.mimeType]}`;

  const row = await deps.db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(media)
      .values({
        r2Key: key,
        mime: body.mimeType,
        byteSize: body.byteSize,
        originalFilename: body.filename,
        alt: blankToNull(body.alt) ?? null,
        credit: blankToNull(body.credit) ?? null,
        status: 'pending',
        uploadedBy: user.id,
      })
      .returning();
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'media', entityId: inserted!.id, diff: { after: { key, mime: body.mimeType, byteSize: body.byteSize } } });
    return inserted!;
  });

  const signed = await storage.client.presignPut(storage.originalsBucket, key, {
    contentType: body.mimeType,
    contentLength: body.byteSize,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });

  return {
    media: toAdminMedia(row, deps.publicBaseUrl),
    upload: {
      url: signed.url,
      method: 'PUT' as const,
      // content-length is signed too, but browsers set it from the body automatically.
      headers: { 'content-type': body.mimeType },
      expiresAt: signed.expiresAt.toISOString(),
    },
  };
}

/** Verifies the uploaded original (exists, exact size, real image type), then queues variant generation. */
export async function confirmUpload(deps: MediaDeps, user: AuthUser, id: number): Promise<AdminMedia> {
  const storage = requireStorage(deps.storage);
  const row = await findMedia(deps.db, id);
  if (row.uploadedBy !== user.id && user.role !== 'editor' && user.role !== 'admin') {
    throw new AppError(403, ErrorCode.FORBIDDEN, 'Only the uploader, editors or admins can confirm this upload');
  }
  if (row.status !== 'pending') {
    throw new AppError(409, ErrorCode.INVALID_STATUS_TRANSITION, `Media is already ${row.status}`);
  }

  // Not uploaded yet (or the PUT is still running): stay pending so the client can confirm again.
  if (!(await storage.client.head(storage.originalsBucket, row.r2Key))) {
    throw new AppError(400, ErrorCode.MEDIA_UPLOAD_INVALID, 'Upload not found in storage; PUT the file before confirming');
  }

  const problem = await verifyOriginal(deps, storage, row);
  if (problem) {
    await setStatus(deps.db, user, row, { status: 'failed', processingError: problem.reason });
    if (problem.deleteObject) await storage.client.deleteObject(storage.originalsBucket, row.r2Key).catch(() => {});
    throw new AppError(400, ErrorCode.MEDIA_UPLOAD_INVALID, problem.reason);
  }

  const updated = await setStatus(deps.db, user, row, { status: 'processing', processingError: null });
  try {
    await deps.jobs.enqueueMediaVariants(id);
  } catch (err) {
    deps.log.error({ err, mediaId: id }, 'Failed to enqueue media variants');
  }
  return toAdminMedia(updated, deps.publicBaseUrl);
}

async function verifyOriginal(
  deps: MediaDeps,
  storage: MediaStorage,
  row: MediaRow,
): Promise<{ reason: string; deleteObject: boolean } | null> {
  const head = await storage.client.head(storage.originalsBucket, row.r2Key);
  if (!head) return { reason: 'Upload disappeared from storage', deleteObject: false };
  if (head.size > deps.maxBytes) return { reason: `Uploaded file exceeds ${deps.maxBytes} bytes`, deleteObject: true };
  if (row.byteSize !== null && head.size !== row.byteSize) {
    return { reason: `Uploaded size ${head.size} does not match declared ${row.byteSize}`, deleteObject: true };
  }
  const leading = await storage.client.getRange(storage.originalsBucket, row.r2Key, 0, SNIFF_BYTES - 1);
  const detected = detectImageType(leading);
  if (detected !== (row.mime as MediaMimeType)) {
    return { reason: `File content is ${detected ?? 'not an allowed image'}, declared ${row.mime}`, deleteObject: true };
  }
  return null;
}

/** Status change guarded on `pending`, so concurrent confirms cannot both win. */
async function setStatus(
  db: Db,
  user: AuthUser,
  row: MediaRow,
  values: { status: 'processing' | 'failed'; processingError: string | null },
): Promise<MediaRow> {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(media)
      .set(values)
      .where(and(eq(media.id, row.id), eq(media.status, 'pending')))
      .returning();
    if (!updated) throw new AppError(409, ErrorCode.INVALID_STATUS_TRANSITION, 'Media is no longer pending');
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'media', entityId: row.id, diff: diffOf(row, updated) });
    return updated;
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Library
// ---------------------------------------------------------------------------------------------------------------

export async function listMedia(deps: MediaDeps, query: z.infer<typeof mediaListQuerySchema>) {
  const conditions: SQL[] = [isNull(media.deletedAt)];
  if (query.status) conditions.push(eq(media.status, query.status));
  if (query.search) {
    const pattern = likePattern(query.search);
    conditions.push(or(ilike(media.alt, pattern), ilike(media.credit, pattern))!);
  }
  const where = and(...conditions);
  const [total] = await deps.db.select({ n: count() }).from(media).where(where);
  const rows = await deps.db
    .select()
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt), desc(media.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map((r) => toAdminMedia(r, deps.publicBaseUrl)), total: total?.n ?? 0 };
}

export async function getMedia(deps: MediaDeps, id: number): Promise<AdminMedia> {
  return toAdminMedia(await findMedia(deps.db, id), deps.publicBaseUrl);
}

export async function updateMedia(deps: MediaDeps, user: AuthUser, id: number, body: UpdateMediaBody): Promise<AdminMedia> {
  const changes: { alt?: string | null; credit?: string | null } = {};
  if (body.alt !== undefined) changes.alt = blankToNull(body.alt) ?? null;
  if (body.credit !== undefined) changes.credit = blankToNull(body.credit) ?? null;
  assertHasChanges(changes);

  return deps.db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(media)
      .where(and(eq(media.id, id), isNull(media.deletedAt)))
      .for('update');
    if (!before) throw notFound('Media');

    const clearing = changes.alt === null || changes.credit === null;
    if (clearing) {
      const [cover] = await tx
        .select({ id: articles.id })
        .from(articles)
        .where(and(eq(articles.coverMediaId, id), isNull(articles.deletedAt)))
        .limit(1);
      if (cover) {
        throw new AppError(409, ErrorCode.IN_USE, `Media is the cover of article ${cover.id}; alt text and credit are required`);
      }
    }

    const [after] = await tx.update(media).set(changes).where(eq(media.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'media', entityId: id, diff: diffOf(before, after!) });
    return toAdminMedia(after!, deps.publicBaseUrl);
  });
}

/** Article covers must be processed and carry alt text and a credit (accessibility + attribution). */
export async function assertUsableCover(db: Pick<Db, 'select'>, mediaId: number): Promise<void> {
  const [row] = await db
    .select({ status: media.status, alt: media.alt, credit: media.credit, deletedAt: media.deletedAt })
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1);
  const problems: string[] = [];
  if (!row || row.deletedAt) problems.push('media does not exist');
  else {
    if (row.status !== 'ready') problems.push(`media is ${row.status}, not ready`);
    if (!row.alt?.trim()) problems.push('alt text is missing');
    if (!row.credit?.trim()) problems.push('credit is missing');
  }
  if (problems.length) {
    throw new AppError(400, ErrorCode.MEDIA_NOT_USABLE, `Cannot use media ${mediaId} as a cover: ${problems.join(', ')}`);
  }
}
