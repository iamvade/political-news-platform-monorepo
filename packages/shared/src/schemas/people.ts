import { z } from 'zod';
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '../translit/slugify';
import {
  adminMetaSchema,
  dataResponse,
  isoDateSchema,
  isoDateTimeSchema,
  listResponse,
  paginationQuerySchema,
  positiveIdSchema,
  queryBooleanSchema,
  sourceUrlSchema,
} from './common';
import { genderSchema, organizationTypeSchema } from './enums';

export const entitySlugSchema = z.string().max(SLUG_MAX_LENGTH).regex(SLUG_PATTERN, 'Lowercase latin letters, digits and dashes');

const nameMn = z.string().trim().min(1).max(200);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalId = positiveIdSchema.nullable().optional();

/** "Г.Батбаяр": first letter of the patronymic + given name (Mongolian convention). */
export function personDisplayName(patronymicMn: string, givenNameMn: string): string {
  const initial = Array.from(patronymicMn.trim())[0] ?? '';
  return initial ? `${initial}.${givenNameMn}` : givenNameMn;
}

// --- Persons ---------------------------------------------------------------------------------------------------

export const createPersonBodySchema = z.object({
  /** Generated from the name when omitted. */
  slug: entitySlugSchema.optional(),
  givenNameMn: nameMn,
  patronymicMn: nameMn,
  givenNameEn: optionalText(200),
  patronymicEn: optionalText(200),
  birthDate: isoDateSchema.nullable().optional(),
  gender: genderSchema.nullable().optional(),
  photoMediaId: optionalId,
  bioMn: optionalText(10_000),
});
export const updatePersonBodySchema = createPersonBodySchema.partial();
export type CreatePersonBody = z.infer<typeof createPersonBodySchema>;
export type UpdatePersonBody = z.infer<typeof updatePersonBodySchema>;

export const adminPersonSchema = adminMetaSchema.extend({
  slug: z.string(),
  displayName: z.string(),
  givenNameMn: z.string(),
  patronymicMn: z.string(),
  givenNameEn: z.string().nullable(),
  patronymicEn: z.string().nullable(),
  birthDate: isoDateSchema.nullable(),
  gender: z.string().nullable(),
  photoMediaId: z.number().int().nullable(),
  bioMn: z.string().nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
});
export type AdminPerson = z.infer<typeof adminPersonSchema>;

export const personListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  /** Admin only. */
  includeDeleted: queryBooleanSchema.optional(),
});

// --- Organizations ---------------------------------------------------------------------------------------------

export const createOrganizationBodySchema = z.object({
  type: organizationTypeSchema,
  slug: entitySlugSchema.optional(),
  nameMn,
  nameEn: optionalText(300),
  shortNameMn: optionalText(50),
  parentId: optionalId,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Hex colour, e.g. #C8102E')
    .nullable()
    .optional(),
  logoMediaId: optionalId,
});
export const updateOrganizationBodySchema = createOrganizationBodySchema.partial();
export type CreateOrganizationBody = z.infer<typeof createOrganizationBodySchema>;
export type UpdateOrganizationBody = z.infer<typeof updateOrganizationBodySchema>;

export const adminOrganizationSchema = adminMetaSchema.extend({
  type: organizationTypeSchema,
  slug: z.string(),
  nameMn: z.string(),
  nameEn: z.string().nullable(),
  shortNameMn: z.string().nullable(),
  parentId: z.number().int().nullable(),
  color: z.string().nullable(),
  logoMediaId: z.number().int().nullable(),
  deletedAt: isoDateTimeSchema.nullable(),
});
export type AdminOrganization = z.infer<typeof adminOrganizationSchema>;

export const organizationListQuerySchema = paginationQuerySchema.extend({
  type: organizationTypeSchema.optional(),
  parentId: z.coerce.number().int().positive().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  includeDeleted: queryBooleanSchema.optional(),
});

// --- Positions -------------------------------------------------------------------------------------------------

const positionFields = z.object({
  personId: positiveIdSchema,
  organizationId: positiveIdSchema,
  titleMn: z.string().trim().min(1).max(200),
  titleEn: optionalText(200),
  startDate: isoDateSchema,
  /** Null = current. */
  endDate: isoDateSchema.nullable().optional(),
  sourceUrl: sourceUrlSchema,
});

const datesOrdered = (value: { startDate?: string; endDate?: string | null }) =>
  !value.startDate || !value.endDate || value.endDate >= value.startDate;
const datesMessage = { message: 'endDate must be on or after startDate', path: ['endDate'] };

export const createPositionBodySchema = positionFields.refine(datesOrdered, datesMessage);
export const updatePositionBodySchema = positionFields.partial().refine(datesOrdered, datesMessage);
export type CreatePositionBody = z.infer<typeof createPositionBodySchema>;
export type UpdatePositionBody = z.infer<typeof updatePositionBodySchema>;

export const adminPositionSchema = adminMetaSchema.extend({
  personId: z.number().int(),
  organizationId: z.number().int(),
  titleMn: z.string(),
  titleEn: z.string().nullable(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.nullable(),
  sourceUrl: z.string(),
});
export type AdminPosition = z.infer<typeof adminPositionSchema>;

export const positionListQuerySchema = paginationQuerySchema.extend({
  personId: z.coerce.number().int().positive().optional(),
  organizationId: z.coerce.number().int().positive().optional(),
  /** true = open positions only (end_date is null); false = ended only. */
  current: queryBooleanSchema.optional(),
});

export const adminPersonResponseSchema = dataResponse(adminPersonSchema);
export const adminPersonListResponseSchema = listResponse(adminPersonSchema);
export const adminOrganizationResponseSchema = dataResponse(adminOrganizationSchema);
export const adminOrganizationListResponseSchema = listResponse(adminOrganizationSchema);
export const adminPositionResponseSchema = dataResponse(adminPositionSchema);
export const adminPositionListResponseSchema = listResponse(adminPositionSchema);
