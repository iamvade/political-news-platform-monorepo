import { z } from 'zod';
import { contentDocSchema } from '../content/schema';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../translit/slugify';
import { dataResponse, listResponse, paginationQuerySchema } from './common';
import { articleStatusSchema, revisionKindSchema } from './enums';

const isoDateTime = z.iso.datetime({ offset: true });
const nullableId = z.number().int().positive().nullable();

export const articleSlugSchema = z.string().max(SLUG_MAX_LENGTH).regex(SLUG_PATTERN, 'Lowercase latin letters, digits and dashes');

export const articleListQuerySchema = paginationQuerySchema.extend({
  status: articleStatusSchema.optional(),
  authorId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  /** Case-insensitive match on the title. */
  search: z.string().trim().min(1).max(200).optional(),
});
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;

export const articleSummarySchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  status: articleStatusSchema,
  authorId: z.number().int(),
  categoryId: nullableId,
  isBreaking: z.boolean(),
  publishedAt: isoDateTime.nullable(),
  scheduledAt: isoDateTime.nullable(),
  updatedAt: isoDateTime,
});
export type ArticleSummary = z.infer<typeof articleSummarySchema>;

export const articleSchema = articleSummarySchema.extend({
  lede: z.string().nullable(),
  bodyJson: contentDocSchema,
  /** Sanitized HTML rendered server-side from bodyJson. */
  bodyHtml: z.string(),
  coverMediaId: nullableId,
  createdAt: isoDateTime,
  tagIds: z.array(z.number().int()),
  personIds: z.array(z.number().int()),
  organizationIds: z.array(z.number().int()),
  billIds: z.array(z.number().int()),
});
export type Article = z.infer<typeof articleSchema>;

/** Replaces the whole set of linked ids (tags, persons, organizations, bills). */
const linkIds = z
  .array(z.number().int().positive())
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, 'Duplicate ids');

export const createArticleBodySchema = z.object({
  title: z.string().trim().min(1).max(300),
  /** Generated from the title when omitted. */
  slug: articleSlugSchema.optional(),
  lede: z.string().trim().max(1000).nullable().optional(),
  bodyJson: contentDocSchema,
  categoryId: nullableId.optional(),
  coverMediaId: nullableId.optional(),
  isBreaking: z.boolean().optional(),
  tagIds: linkIds.optional(),
  personIds: linkIds.optional(),
  organizationIds: linkIds.optional(),
  billIds: linkIds.optional(),
});
export type CreateArticleBody = z.infer<typeof createArticleBodySchema>;

/** Required when editing a published article: substantive edits are logged in the public corrections log. */
export const articleEditSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('minor') }),
  z.object({
    type: z.literal('substantive'),
    correction: z.object({
      description: z.string().trim().min(1).max(2000),
      reason: z.string().trim().min(1).max(500),
    }),
  }),
]);
export type ArticleEdit = z.infer<typeof articleEditSchema>;

export const updateArticleBodySchema = createArticleBodySchema.partial().extend({
  edit: articleEditSchema.optional(),
  /** The `updatedAt` the client last saw; a mismatch → 409 EDIT_CONFLICT (someone else saved). */
  expectedUpdatedAt: isoDateTime.optional(),
  /** Background save from the editor: draft/in_review only, coalesced into one revision per 5 minutes. */
  autosave: z.boolean().optional(),
});
export type UpdateArticleBody = z.infer<typeof updateArticleBodySchema>;

export const restoreRevisionBodySchema = z.object({ edit: articleEditSchema.optional() });
export type RestoreRevisionBody = z.infer<typeof restoreRevisionBodySchema>;

export const scheduleArticleBodySchema = z.object({ scheduledAt: isoDateTime });
export type ScheduleArticleBody = z.infer<typeof scheduleArticleBodySchema>;

export const returnToDraftBodySchema = z.object({ note: z.string().trim().max(1000).optional() });
export type ReturnToDraftBody = z.infer<typeof returnToDraftBodySchema>;

export const revisionParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  revisionId: z.coerce.number().int().positive(),
});

export const articleRevisionSchema = z.object({
  id: z.number().int(),
  articleId: z.number().int(),
  kind: revisionKindSchema,
  editorId: z.number().int(),
  createdAt: isoDateTime,
  snapshot: z.record(z.string(), z.unknown()),
});
export type ArticleRevision = z.infer<typeof articleRevisionSchema>;

export const articleResponseSchema = dataResponse(articleSchema);
export const articleListResponseSchema = listResponse(articleSummarySchema);
export const articleRevisionListResponseSchema = listResponse(articleRevisionSchema);
