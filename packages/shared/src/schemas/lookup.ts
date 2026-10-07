import { z } from 'zod';
import { dataResponse } from './common';

/** Picker lookups for the editor (persons, organizations, bills, categories, tags). Open to every newsroom role. */
export const LOOKUP_KINDS = ['persons', 'organizations', 'bills', 'categories', 'tags'] as const;
export type LookupKind = (typeof LOOKUP_KINDS)[number];

export const lookupQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  /** Comma-separated ids to hydrate already-selected items, e.g. `ids=3,17`. */
  ids: z
    .string()
    .regex(/^\d+(,\d+){0,49}$/, 'Comma-separated ids (max 50)')
    .transform((value) => value.split(',').map(Number))
    .optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type LookupQuery = z.infer<typeof lookupQuerySchema>;

export const lookupItemSchema = z.object({
  id: z.number().int(),
  label: z.string(),
  sublabel: z.string().nullable(),
  /** Photo / logo (smallest WebP variant), null when there is none. */
  imageUrl: z.string().nullable(),
});
export type LookupItem = z.infer<typeof lookupItemSchema>;
export const lookupResponseSchema = dataResponse(z.array(lookupItemSchema));

export const taxonomyItemSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  nameMn: z.string(),
  nameEn: z.string().nullable(),
});
export type TaxonomyItem = z.infer<typeof taxonomyItemSchema>;
export const taxonomyItemResponseSchema = dataResponse(taxonomyItemSchema);

export const createTagBodySchema = z.object({
  nameMn: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().max(100).nullable().optional(),
});
export type CreateTagBody = z.infer<typeof createTagBodySchema>;
