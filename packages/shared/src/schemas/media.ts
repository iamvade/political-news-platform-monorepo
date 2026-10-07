import { z } from 'zod';
import { adminMetaSchema, dataResponse, isoDateTimeSchema, listResponse, paginationQuerySchema } from './common';
import { mediaStatusSchema } from './enums';
import { mediaVariantSchema } from './public';

/** Upload allowlist. HEIC is excluded (prebuilt sharp cannot decode it); GIF is excluded (animation would be lost). */
export const MEDIA_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
export const mediaMimeTypeSchema = z.enum(MEDIA_MIME_TYPES);
export type MediaMimeType = z.infer<typeof mediaMimeTypeSchema>;

/** Variant widths generated for every image (WebP). */
export const MEDIA_VARIANT_WIDTHS = [320, 640, 1024, 1600] as const;

const altSchema = z.string().trim().max(500).nullable();
const creditSchema = z.string().trim().max(300).nullable();

export const requestUploadBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: mediaMimeTypeSchema,
  /** Exact size in bytes; it is signed into the upload URL, so the PUT must match. */
  byteSize: z.number().int().positive(),
  alt: altSchema.optional(),
  credit: creditSchema.optional(),
});
export type RequestUploadBody = z.infer<typeof requestUploadBodySchema>;

export const updateMediaBodySchema = z.object({ alt: altSchema.optional(), credit: creditSchema.optional() });
export type UpdateMediaBody = z.infer<typeof updateMediaBodySchema>;

export const adminMediaSchema = adminMetaSchema.extend({
  status: mediaStatusSchema,
  mime: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  byteSize: z.number().int().nullable(),
  originalFilename: z.string().nullable(),
  alt: z.string().nullable(),
  credit: z.string().nullable(),
  processingError: z.string().nullable(),
  uploadedBy: z.number().int().nullable(),
  /** WebP variants, smallest first. The original is private and has no URL. */
  variants: z.array(mediaVariantSchema),
});
export type AdminMedia = z.infer<typeof adminMediaSchema>;

/** Where and how the browser uploads the original. Send exactly these headers. */
export const uploadTicketSchema = z.object({
  url: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: isoDateTimeSchema,
});

export const mediaListQuerySchema = paginationQuerySchema.extend({
  /** Case-insensitive match on alt or credit. */
  search: z.string().trim().min(1).max(200).optional(),
  status: mediaStatusSchema.optional(),
});

export const adminMediaResponseSchema = dataResponse(adminMediaSchema);
export const adminMediaListResponseSchema = listResponse(adminMediaSchema);
export const requestUploadResponseSchema = dataResponse(z.object({ media: adminMediaSchema, upload: uploadTicketSchema }));
