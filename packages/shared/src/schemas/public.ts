import { z } from 'zod';
import { contentDocSchema } from '../content/schema';
import { dataResponse, isoDateSchema, isoDateTimeSchema, listResponse, paginationQuerySchema } from './common';
import {
  billInitiatorSchema,
  billStageSchema,
  billStatusSchema,
  organizationTypeSchema,
  promiseEvidenceSchema,
  promiseStatusSchema,
  sponsorRoleSchema,
  voteValueSchema,
} from './enums';

// Public DTOs: only fields meant for readers. Never add internal fields (emails, deleted_at, editor ids).

export const slugParamsSchema = z.object({ slug: z.string().min(1).max(200) });

export const mediaVariantSchema = z.object({
  width: z.number().int(),
  height: z.number().int(),
  /** Null until MEDIA_PUBLIC_BASE_URL is configured. */
  url: z.string().nullable(),
});

export const publicMediaSchema = z.object({
  /** The 1024px WebP variant (or the largest smaller one). Null until MEDIA_PUBLIC_BASE_URL is configured. */
  url: z.string().nullable(),
  /** All WebP variants, smallest first, for srcset. */
  variants: z.array(mediaVariantSchema),
  alt: z.string().nullable(),
  credit: z.string().nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
});

export const publicPersonRefSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  givenNameMn: z.string(),
  patronymicMn: z.string(),
});

export const publicOrganizationRefSchema = z.object({
  slug: z.string(),
  type: organizationTypeSchema,
  nameMn: z.string(),
  nameEn: z.string().nullable(),
  shortNameMn: z.string().nullable(),
  color: z.string().nullable(),
});

export const publicTaxonomySchema = z.object({ slug: z.string(), nameMn: z.string(), nameEn: z.string().nullable() });

// --- Articles --------------------------------------------------------------------------------------------------

export const publicArticleListQuerySchema = paginationQuerySchema.extend({
  category: z.string().min(1).max(200).optional(),
  tag: z.string().min(1).max(200).optional(),
});

export const publicArticleSummarySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  title: z.string(),
  lede: z.string().nullable(),
  isBreaking: z.boolean(),
  publishedAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  category: publicTaxonomySchema.nullable(),
  cover: publicMediaSchema.nullable(),
});
export type PublicArticleSummary = z.infer<typeof publicArticleSummarySchema>;

export const publicArticleSchema = publicArticleSummarySchema.extend({
  bodyHtml: z.string(),
  bodyJson: contentDocSchema,
  author: z.object({ displayName: z.string() }),
  tags: z.array(publicTaxonomySchema),
  persons: z.array(publicPersonRefSchema),
  organizations: z.array(publicOrganizationRefSchema),
  bills: z.array(z.object({ slug: z.string(), titleMn: z.string() })),
  corrections: z.array(z.object({ date: isoDateSchema, description: z.string(), reason: z.string() })),
});
export type PublicArticle = z.infer<typeof publicArticleSchema>;

// --- Homepage --------------------------------------------------------------------------------------------------

/** The live homepage, resolved: pinned articles that are no longer published are replaced by the latest ones. */
export const publicHomepageSchema = z.object({
  hero: publicArticleSummarySchema.nullable(),
  featured: z.array(publicArticleSummarySchema),
  sections: z.array(z.object({ category: publicTaxonomySchema, articles: z.array(publicArticleSummarySchema) })),
  /** When the live layout was saved (null = no layout saved yet, defaults used). */
  updatedAt: isoDateTimeSchema.nullable(),
});
export type PublicHomepage = z.infer<typeof publicHomepageSchema>;

// --- Persons ---------------------------------------------------------------------------------------------------

export const publicPositionSchema = z.object({
  titleMn: z.string(),
  titleEn: z.string().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  sourceUrl: z.string(),
  organization: publicOrganizationRefSchema,
});

export const publicPersonSchema = publicPersonRefSchema.extend({
  givenNameEn: z.string().nullable(),
  patronymicEn: z.string().nullable(),
  birthDate: isoDateSchema.nullable(),
  bioMn: z.string().nullable(),
  photo: publicMediaSchema.nullable(),
  currentPositions: z.array(publicPositionSchema),
  party: publicOrganizationRefSchema.nullable(),
  constituency: publicOrganizationRefSchema.nullable(),
});
export type PublicPerson = z.infer<typeof publicPersonSchema>;

export const publicPersonVoteSchema = z.object({
  bill: z.object({ slug: z.string(), titleMn: z.string() }),
  value: voteValueSchema,
  date: isoDateSchema,
  motion: z.string(),
  sourceUrl: z.string(),
});

export const publicStatementSchema = z.object({
  quoteMn: z.string(),
  contextMn: z.string().nullable(),
  saidOn: isoDateSchema,
  sourceUrl: z.string(),
  article: z.object({ slug: z.string(), title: z.string() }).nullable(),
});

export const publicPromiseSchema = z.object({
  textMn: z.string(),
  madeOn: isoDateSchema,
  status: promiseStatusSchema,
  evidence: z.array(promiseEvidenceSchema),
  lastReviewedAt: isoDateTimeSchema.nullable(),
  sourceUrl: z.string(),
});

export const publicDeclarationSchema = z.object({
  year: z.number().int(),
  filedOn: isoDateSchema.nullable(),
  income: z.string().nullable(),
  assets: z.string().nullable(),
  liabilities: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  sourceUrl: z.string(),
});

// --- Organizations ---------------------------------------------------------------------------------------------

export const publicOrganizationSchema = publicOrganizationRefSchema.extend({
  parent: publicOrganizationRefSchema.nullable(),
  logo: publicMediaSchema.nullable(),
  /** Current members (open positions), sorted by title then name. */
  members: z.array(
    z.object({
      person: publicPersonRefSchema,
      titleMn: z.string(),
      titleEn: z.string().nullable(),
      startDate: isoDateSchema,
    }),
  ),
});

// --- Bills -----------------------------------------------------------------------------------------------------

export const voteTallySchema = z.object({
  yes: z.number().int(),
  no: z.number().int(),
  abstain: z.number().int(),
  absent: z.number().int(),
});

export const publicBillSchema = z.object({
  slug: z.string(),
  titleMn: z.string(),
  titleEn: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  initiatorType: billInitiatorSchema,
  status: billStatusSchema,
  submittedOn: isoDateSchema.nullable(),
  sourceUrl: z.string(),
  sponsors: z.array(z.object({ person: publicPersonRefSchema, role: sponsorRoleSchema })),
  stages: z.array(z.object({ stage: billStageSchema, date: isoDateSchema, noteMn: z.string().nullable(), sourceUrl: z.string() })),
  /** One entry per recorded vote (date + motion), oldest first. */
  votes: z.array(
    z.object({
      date: isoDateSchema,
      motion: z.string(),
      sourceUrl: z.string(),
      tally: voteTallySchema,
      votes: z.array(z.object({ person: publicPersonRefSchema, value: voteValueSchema })),
    }),
  ),
});
export type PublicBill = z.infer<typeof publicBillSchema>;

export const publicArticleListResponseSchema = listResponse(publicArticleSummarySchema);
export const publicHomepageResponseSchema = dataResponse(publicHomepageSchema);
export const publicArticleResponseSchema = dataResponse(publicArticleSchema);
export const publicTaxonomyResponseSchema = dataResponse(publicTaxonomySchema);
export const publicPersonResponseSchema = dataResponse(publicPersonSchema);
export const publicPositionListResponseSchema = listResponse(publicPositionSchema);
export const publicPersonVoteListResponseSchema = listResponse(publicPersonVoteSchema);
export const publicStatementListResponseSchema = listResponse(publicStatementSchema);
export const publicPromiseListResponseSchema = listResponse(publicPromiseSchema);
export const publicDeclarationListResponseSchema = listResponse(publicDeclarationSchema);
export const publicOrganizationResponseSchema = dataResponse(publicOrganizationSchema);
export const publicBillResponseSchema = dataResponse(publicBillSchema);
