import { z } from 'zod';
import { adminMetaSchema, dataResponse, isoDateSchema, listResponse, paginationQuerySchema, positiveIdSchema } from './common';
import { correctionEntityTypeSchema } from './enums';

export const createCorrectionBodySchema = z.object({
  entityType: correctionEntityTypeSchema,
  entityId: positiveIdSchema,
  date: isoDateSchema,
  description: z.string().trim().min(1).max(2000),
  reason: z.string().trim().min(1).max(500),
});
export const updateCorrectionBodySchema = createCorrectionBodySchema.partial();
export type CreateCorrectionBody = z.infer<typeof createCorrectionBodySchema>;
export type UpdateCorrectionBody = z.infer<typeof updateCorrectionBodySchema>;

export const adminCorrectionSchema = adminMetaSchema.extend({
  entityType: correctionEntityTypeSchema,
  entityId: z.number().int(),
  date: isoDateSchema,
  description: z.string(),
  reason: z.string(),
  createdBy: z.number().int(),
});
export type AdminCorrection = z.infer<typeof adminCorrectionSchema>;

export const correctionListQuerySchema = paginationQuerySchema.extend({
  entityType: correctionEntityTypeSchema.optional(),
  entityId: z.coerce.number().int().positive().optional(),
});

export const adminCorrectionResponseSchema = dataResponse(adminCorrectionSchema);
export const adminCorrectionListResponseSchema = listResponse(adminCorrectionSchema);
