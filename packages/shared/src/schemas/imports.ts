import { z } from 'zod';
import { dataResponse, isoDateSchema, positiveIdSchema, sourceUrlSchema } from './common';
import { voteValueSchema } from './enums';
import { voteMotionSchema } from './legislation';
import { entitySlugSchema } from './people';

export const IMPORT_MAX_ROWS = 5_000;

/** Rows reference entities by exactly one of `<name>Id` or `<name>Slug` (spreadsheets usually carry slugs). */
function exactlyOneRef(names: string[]) {
  return (row: Record<string, unknown>, ctx: z.RefinementCtx) => {
    for (const name of names) {
      const hasId = row[`${name}Id`] !== undefined;
      const hasSlug = row[`${name}Slug`] !== undefined;
      if (hasId === hasSlug) {
        ctx.addIssue({ code: 'custom', message: `Provide exactly one of ${name}Id or ${name}Slug`, path: [`${name}Id`] });
      }
    }
  };
}

export const voteImportRowSchema = z
  .object({
    billId: positiveIdSchema.optional(),
    billSlug: entitySlugSchema.optional(),
    personId: positiveIdSchema.optional(),
    personSlug: entitySlugSchema.optional(),
    value: voteValueSchema,
    date: isoDateSchema,
    motion: voteMotionSchema,
    sourceUrl: sourceUrlSchema,
  })
  .superRefine(exactlyOneRef(['bill', 'person']));
export type VoteImportRow = z.infer<typeof voteImportRowSchema>;

export const positionImportRowSchema = z
  .object({
    personId: positiveIdSchema.optional(),
    personSlug: entitySlugSchema.optional(),
    organizationId: positiveIdSchema.optional(),
    organizationSlug: entitySlugSchema.optional(),
    titleMn: z.string().trim().min(1).max(200),
    titleEn: z.string().trim().max(200).nullable().optional(),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable().optional(),
    sourceUrl: sourceUrlSchema,
  })
  .superRefine(exactlyOneRef(['person', 'organization']))
  .refine((row) => !row.endDate || row.endDate >= row.startDate, {
    message: 'endDate must be on or after startDate',
    path: ['endDate'],
  });
export type PositionImportRow = z.infer<typeof positionImportRowSchema>;

function importBody<T extends z.ZodType>(row: T) {
  return z.object({
    /** Validate and compute the diff, then roll back. */
    dryRun: z.boolean().default(false),
    rows: z.array(row).min(1).max(IMPORT_MAX_ROWS),
  });
}

export const voteImportBodySchema = importBody(voteImportRowSchema);
export const positionImportBodySchema = importBody(positionImportRowSchema);
export type VoteImportBody = z.infer<typeof voteImportBodySchema>;
export type PositionImportBody = z.infer<typeof positionImportBodySchema>;

const record = z.record(z.string(), z.unknown());

export const importResultSchema = z.object({
  dryRun: z.boolean(),
  summary: z.object({ create: z.number().int(), update: z.number().int(), unchanged: z.number().int() }),
  diff: z.object({
    create: z.array(record),
    update: z.array(z.object({ key: record, before: record, after: record })),
  }),
});
export type ImportResult = z.infer<typeof importResultSchema>;
export const importResultResponseSchema = dataResponse(importResultSchema);
