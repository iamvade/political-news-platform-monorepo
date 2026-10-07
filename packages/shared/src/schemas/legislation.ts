import { z } from 'zod';
import {
  adminMetaSchema,
  dataResponse,
  isoDateSchema,
  listResponse,
  paginationQuerySchema,
  positiveIdSchema,
  sourceUrlSchema,
} from './common';
import { billInitiatorSchema, billStageSchema, billStatusSchema, sponsorRoleSchema, voteValueSchema } from './enums';
import { entitySlugSchema } from './people';

// --- Bills -----------------------------------------------------------------------------------------------------

export const createBillBodySchema = z.object({
  slug: entitySlugSchema.optional(),
  titleMn: z.string().trim().min(1).max(500),
  titleEn: z.string().trim().max(500).nullable().optional(),
  registrationNumber: z.string().trim().max(100).nullable().optional(),
  initiatorType: billInitiatorSchema,
  status: billStatusSchema,
  submittedOn: isoDateSchema.nullable().optional(),
  sourceUrl: sourceUrlSchema,
});
export const updateBillBodySchema = createBillBodySchema.partial();
export type CreateBillBody = z.infer<typeof createBillBodySchema>;
export type UpdateBillBody = z.infer<typeof updateBillBodySchema>;

export const billSponsorSchema = z.object({ personId: positiveIdSchema, role: sponsorRoleSchema });
export const replaceSponsorsBodySchema = z.object({
  sponsors: z
    .array(billSponsorSchema)
    .max(200)
    .refine((list) => new Set(list.map((s) => s.personId)).size === list.length, 'Each person may appear once'),
});
export type ReplaceSponsorsBody = z.infer<typeof replaceSponsorsBodySchema>;

export const adminBillSchema = adminMetaSchema.extend({
  slug: z.string(),
  titleMn: z.string(),
  titleEn: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  initiatorType: billInitiatorSchema,
  status: billStatusSchema,
  submittedOn: isoDateSchema.nullable(),
  sourceUrl: z.string(),
  sponsors: z.array(billSponsorSchema),
});
export type AdminBill = z.infer<typeof adminBillSchema>;

export const billListQuerySchema = paginationQuerySchema.extend({
  status: billStatusSchema.optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

// --- Bill stages -----------------------------------------------------------------------------------------------

export const createBillStageBodySchema = z.object({
  billId: positiveIdSchema,
  stage: billStageSchema,
  date: isoDateSchema,
  noteMn: z.string().trim().max(2000).nullable().optional(),
  sourceUrl: sourceUrlSchema,
});
export const updateBillStageBodySchema = createBillStageBodySchema.partial();
export type CreateBillStageBody = z.infer<typeof createBillStageBodySchema>;
export type UpdateBillStageBody = z.infer<typeof updateBillStageBodySchema>;

export const adminBillStageSchema = adminMetaSchema.extend({
  billId: z.number().int(),
  stage: billStageSchema,
  date: isoDateSchema,
  noteMn: z.string().nullable(),
  sourceUrl: z.string(),
});
export type AdminBillStage = z.infer<typeof adminBillStageSchema>;

export const billStageListQuerySchema = paginationQuerySchema.extend({
  billId: z.coerce.number().int().positive().optional(),
});

// --- Votes -----------------------------------------------------------------------------------------------------

/** Identifies which vote on that day, e.g. `consideration`, `final_vote`, `amendment_3`. */
export const voteMotionSchema = z.string().trim().min(1).max(100);

export const createVoteBodySchema = z.object({
  billId: positiveIdSchema,
  personId: positiveIdSchema,
  value: voteValueSchema,
  date: isoDateSchema,
  motion: voteMotionSchema,
  sourceUrl: sourceUrlSchema,
});
export const updateVoteBodySchema = createVoteBodySchema.partial();
export type CreateVoteBody = z.infer<typeof createVoteBodySchema>;
export type UpdateVoteBody = z.infer<typeof updateVoteBodySchema>;

export const adminVoteSchema = adminMetaSchema.extend({
  billId: z.number().int(),
  personId: z.number().int(),
  value: voteValueSchema,
  date: isoDateSchema,
  motion: z.string(),
  sourceUrl: z.string(),
});
export type AdminVote = z.infer<typeof adminVoteSchema>;

export const voteListQuerySchema = paginationQuerySchema.extend({
  billId: z.coerce.number().int().positive().optional(),
  personId: z.coerce.number().int().positive().optional(),
  date: isoDateSchema.optional(),
  motion: voteMotionSchema.optional(),
});

export const adminBillResponseSchema = dataResponse(adminBillSchema);
export const adminBillListResponseSchema = listResponse(adminBillSchema);
export const adminBillStageResponseSchema = dataResponse(adminBillStageSchema);
export const adminBillStageListResponseSchema = listResponse(adminBillStageSchema);
export const adminVoteResponseSchema = dataResponse(adminVoteSchema);
export const adminVoteListResponseSchema = listResponse(adminVoteSchema);
