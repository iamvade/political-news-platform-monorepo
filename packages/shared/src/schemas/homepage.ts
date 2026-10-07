import { z } from 'zod';
import { articleSummarySchema } from './articles';
import { dataResponse, isoDateTimeSchema, listResponse, positiveIdSchema } from './common';

/** Featured slots under the hero (PRD §9.7 "top stack"). */
export const HOMEPAGE_FEATURED_SLOTS = 4;
export const HOMEPAGE_MAX_SECTIONS = 20;

const unique = (ids: number[]) => new Set(ids).size === ids.length;

/** What editors pin on the homepage. Stored as `homepage_layouts.zones`. */
export const homepageZonesSchema = z
  .object({
    heroArticleId: positiveIdSchema.nullable(),
    featuredArticleIds: z.array(positiveIdSchema).max(HOMEPAGE_FEATURED_SLOTS).refine(unique, 'Duplicate ids'),
    /** Category rails, in display order. */
    sectionCategoryIds: z.array(positiveIdSchema).max(HOMEPAGE_MAX_SECTIONS).refine(unique, 'Duplicate ids'),
  })
  .refine((zones) => zones.heroArticleId === null || !zones.featuredArticleIds.includes(zones.heroArticleId), {
    message: 'The hero article cannot also be featured',
    path: ['featuredArticleIds'],
  });
export type HomepageZones = z.infer<typeof homepageZonesSchema>;

/** Saving makes a new live version. `expectedVersion` = the version the editor loaded (null if none existed). */
export const saveHomepageBodySchema = z.object({
  zones: homepageZonesSchema,
  expectedVersion: z.number().int().positive().nullable(),
});
export type SaveHomepageBody = z.infer<typeof saveHomepageBodySchema>;

export const adminHomepageSchema = z.object({
  /** Live version (null = nothing saved yet). */
  version: z.number().int().nullable(),
  zones: homepageZonesSchema,
  /** The pinned articles in any status, so the editor can flag ones that are no longer published. */
  articles: z.array(articleSummarySchema),
  categories: z.array(z.object({ id: z.number().int(), nameMn: z.string() })),
  createdAt: isoDateTimeSchema.nullable(),
  createdBy: z.number().int().nullable(),
});
export type AdminHomepage = z.infer<typeof adminHomepageSchema>;

export const homepageVersionSchema = z.object({
  version: z.number().int(),
  zones: homepageZonesSchema,
  createdAt: isoDateTimeSchema,
  createdBy: z.number().int(),
});
export type HomepageVersion = z.infer<typeof homepageVersionSchema>;

export const adminHomepageResponseSchema = dataResponse(adminHomepageSchema);
export const homepageVersionListResponseSchema = listResponse(homepageVersionSchema);
