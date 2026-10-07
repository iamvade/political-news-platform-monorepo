import { MEDIA_STATUSES } from '@news/shared/schemas';
import { index, integer, jsonb, pgEnum, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { fk, id, softDelete, timestamps } from '../columns';
import { users } from './users';

/**
 * Generated WebP renditions in the public bucket, keyed `w<width>`:
 * `{ "w640": { "key": "media/12/w640.webp", "width": 640, "height": 360, "bytes": 41234 } }`.
 * Keys only — URLs are built from MEDIA_PUBLIC_BASE_URL at response time.
 */
export type MediaVariants = Record<string, { key: string; width: number; height: number; bytes?: number; mime?: string }>;

export const mediaStatus = pgEnum('media_status', MEDIA_STATUSES);

export const media = pgTable(
  'media',
  {
    id: id(),
    /** Key of the original in the PRIVATE originals bucket. */
    r2Key: text().notNull(),
    mime: text().notNull(),
    status: mediaStatus().notNull().default('pending'),
    originalFilename: text(),
    processingError: text(),
    /** Null for non-image media (PDFs). */
    width: integer(),
    height: integer(),
    byteSize: integer(),
    /** Required for images; enforced in the API schema, not here (PDFs have none). */
    alt: text(),
    credit: text(),
    variants: jsonb().$type<MediaVariants>().notNull().default({}),
    uploadedBy: fk().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('media_r2_key_unique').on(t.r2Key),
    index('media_uploaded_by_idx').on(t.uploadedBy),
    index('media_status_idx').on(t.status),
    // Media library search (ILIKE on alt / credit).
    index('media_alt_trgm_idx').using('gin', t.alt.op('gin_trgm_ops')),
    index('media_credit_trgm_idx').using('gin', t.credit.op('gin_trgm_ops')),
  ],
);
