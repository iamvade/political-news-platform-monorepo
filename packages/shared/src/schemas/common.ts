import { z } from 'zod';

/** Stable error codes shared by the API and every client. Clients map these to UI text. */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  CSRF_INVALID: 'CSRF_INVALID',
  ARTICLE_NOT_FOUND: 'ARTICLE_NOT_FOUND',
  REVISION_NOT_FOUND: 'REVISION_NOT_FOUND',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  SLUG_TAKEN: 'SLUG_TAKEN',
  CORRECTION_REQUIRED: 'CORRECTION_REQUIRED',
  EDIT_CONFLICT: 'EDIT_CONFLICT',
  ARTICLE_NOT_PUBLISHED: 'ARTICLE_NOT_PUBLISHED',
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  IN_USE: 'IN_USE',
  DUPLICATE: 'DUPLICATE',
  IMPORT_INVALID: 'IMPORT_INVALID',
  GONE: 'GONE',
  MEDIA_TOO_LARGE: 'MEDIA_TOO_LARGE',
  MEDIA_UPLOAD_INVALID: 'MEDIA_UPLOAD_INVALID',
  MEDIA_NOT_USABLE: 'MEDIA_NOT_USABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const validationIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type ValidationIssue = z.infer<typeof validationIssueSchema>;

/** `{ error: { code, message } }` — the only error shape the API returns. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present only on VALIDATION_ERROR. */
    details: z.array(validationIssueSchema).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const paginationMetaSchema = z.object({
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

/** Single item: `{ data: T }` */
export function dataResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: item });
}

/** List: `{ data: T[], pagination }` */
export function listResponse<T extends z.ZodType>(item: T) {
  return z.object({ data: z.array(item), pagination: paginationMetaSchema });
}

/** Empty body (204 No Content). */
export const noContentSchema = z.undefined();

/** `:id` route params. */
export const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

/** Shared field schemas. */
export const positiveIdSchema = z.number().int().positive();
export const isoDateSchema = z.iso.date();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
/** Provenance link required on factual records (mirrors the DB CHECK `^https?://`). */
export const sourceUrlSchema = z.url({ protocol: /^https?$/ }).max(2048);

/** Query-string boolean: "true" / "false". */
export const queryBooleanSchema = z.enum(['true', 'false']).transform((v) => v === 'true');

/** Fields every admin DTO carries. */
export const adminMetaSchema = z.object({
  id: z.number().int(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

