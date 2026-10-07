import { z } from 'zod';
import {
  adminMetaSchema,
  dataResponse,
  isoDateSchema,
  isoDateTimeSchema,
  listResponse,
  paginationQuerySchema,
  positiveIdSchema,
  sourceUrlSchema,
} from './common';
import { promiseEvidenceSchema, promiseStatusSchema } from './enums';

// --- Statements ------------------------------------------------------------------------------------------------

export const createStatementBodySchema = z.object({
  personId: positiveIdSchema,
  quoteMn: z.string().trim().min(1).max(5000),
  contextMn: z.string().trim().max(2000).nullable().optional(),
  saidOn: isoDateSchema,
  articleId: positiveIdSchema.nullable().optional(),
  sourceUrl: sourceUrlSchema,
});
export const updateStatementBodySchema = createStatementBodySchema.partial();
export type CreateStatementBody = z.infer<typeof createStatementBodySchema>;
export type UpdateStatementBody = z.infer<typeof updateStatementBodySchema>;

export const adminStatementSchema = adminMetaSchema.extend({
  personId: z.number().int(),
  quoteMn: z.string(),
  contextMn: z.string().nullable(),
  saidOn: isoDateSchema,
  articleId: z.number().int().nullable(),
  sourceUrl: z.string(),
});
export type AdminStatement = z.infer<typeof adminStatementSchema>;

export const statementListQuerySchema = paginationQuerySchema.extend({
  personId: z.coerce.number().int().positive().optional(),
  articleId: z.coerce.number().int().positive().optional(),
});

// --- Promises --------------------------------------------------------------------------------------------------

const promiseFields = z.object({
  personId: positiveIdSchema.nullable().optional(),
  organizationId: positiveIdSchema.nullable().optional(),
  textMn: z.string().trim().min(1).max(5000),
  madeOn: isoDateSchema,
  /** Status changes only through POST /promises/:id/status, which records a note and evidence. New promises are `not_rated`. */
  status: z.never({ error: 'Change status with POST /promises/:id/status' }).optional(),
  evidence: z.array(promiseEvidenceSchema).max(50).optional(),
  lastReviewedAt: isoDateTimeSchema.nullable().optional(),
  sourceUrl: sourceUrlSchema,
});

const subjectMessage = { message: 'Exactly one of personId or organizationId is required', path: ['personId'] };

export const createPromiseBodySchema = promiseFields.refine(
  (value) => (value.personId ? 1 : 0) + (value.organizationId ? 1 : 0) === 1,
  subjectMessage,
);
/** On update only reject setting both at once; the DB CHECK guards the combined result. */
export const updatePromiseBodySchema = promiseFields
  .partial()
  .refine((value) => !(value.personId && value.organizationId), subjectMessage);
export type CreatePromiseBody = z.infer<typeof createPromiseBodySchema>;
export type UpdatePromiseBody = z.infer<typeof updatePromiseBodySchema>;

export const adminPromiseSchema = adminMetaSchema.extend({
  personId: z.number().int().nullable(),
  organizationId: z.number().int().nullable(),
  textMn: z.string(),
  madeOn: isoDateSchema,
  status: promiseStatusSchema,
  evidence: z.array(promiseEvidenceSchema),
  lastReviewedAt: isoDateTimeSchema.nullable(),
  sourceUrl: z.string(),
});
export type AdminPromise = z.infer<typeof adminPromiseSchema>;

export const promiseListQuerySchema = paginationQuerySchema.extend({
  personId: z.coerce.number().int().positive().optional(),
  organizationId: z.coerce.number().int().positive().optional(),
  status: promiseStatusSchema.optional(),
});

/** A dated status decision on a promise: the note explains it, the source URL is the evidence. */
export const promiseStatusChangeBodySchema = z.object({
  status: promiseStatusSchema,
  date: isoDateSchema,
  noteMn: z.string().trim().min(1).max(2000),
  sourceUrl: sourceUrlSchema,
});
export type PromiseStatusChangeBody = z.infer<typeof promiseStatusChangeBodySchema>;

export const adminPromiseUpdateSchema = z.object({
  id: z.number().int(),
  promiseId: z.number().int(),
  status: promiseStatusSchema,
  date: isoDateSchema,
  noteMn: z.string(),
  sourceUrl: z.string(),
  createdBy: z.number().int(),
  createdAt: isoDateTimeSchema,
});
export type AdminPromiseUpdate = z.infer<typeof adminPromiseUpdateSchema>;

// --- Declarations ----------------------------------------------------------------------------------------------

/** MNT amount as a decimal string (never a float), up to 16 integer digits and 2 decimals. */
export const mntAmountSchema = z.string().regex(/^-?\d{1,16}(\.\d{1,2})?$/, 'Decimal string, e.g. "125000000.00"');

export const createDeclarationBodySchema = z.object({
  personId: positiveIdSchema,
  year: z.number().int().min(1990).max(2100),
  filedOn: isoDateSchema.nullable().optional(),
  income: mntAmountSchema.nullable().optional(),
  assets: mntAmountSchema.nullable().optional(),
  liabilities: mntAmountSchema.nullable().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
  sourceUrl: sourceUrlSchema,
});
export const updateDeclarationBodySchema = createDeclarationBodySchema.partial();
export type CreateDeclarationBody = z.infer<typeof createDeclarationBodySchema>;
export type UpdateDeclarationBody = z.infer<typeof updateDeclarationBodySchema>;

export const adminDeclarationSchema = adminMetaSchema.extend({
  personId: z.number().int(),
  year: z.number().int(),
  filedOn: isoDateSchema.nullable(),
  income: z.string().nullable(),
  assets: z.string().nullable(),
  liabilities: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  sourceUrl: z.string(),
});
export type AdminDeclaration = z.infer<typeof adminDeclarationSchema>;

export const declarationListQuerySchema = paginationQuerySchema.extend({
  personId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().optional(),
});

export const adminStatementResponseSchema = dataResponse(adminStatementSchema);
export const adminStatementListResponseSchema = listResponse(adminStatementSchema);
export const adminPromiseResponseSchema = dataResponse(adminPromiseSchema);
export const adminPromiseListResponseSchema = listResponse(adminPromiseSchema);
export const adminPromiseUpdateListResponseSchema = listResponse(adminPromiseUpdateSchema);
export const adminDeclarationResponseSchema = dataResponse(adminDeclarationSchema);
export const adminDeclarationListResponseSchema = listResponse(adminDeclarationSchema);
