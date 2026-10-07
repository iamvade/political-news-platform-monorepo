import type { LookupItem, LookupKind, LookupQuery } from '@news/shared/schemas';
import { personDisplayName } from '@news/shared/schemas';
import { and, asc, eq, ilike, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { Db } from '../../db/client';
import { bills, categories, media, organizations, persons, positions, tags, type MediaVariants } from '../../db/schema/index';
import { likePattern } from '../../lib/crud';
import { variantList } from '../../lib/media';

/** Picker lookups for the article editor. `ids` hydrates selected items; otherwise `search` filters (ILIKE). */
export async function lookup(db: Db, mediaBase: string | undefined, kind: LookupKind, query: LookupQuery): Promise<LookupItem[]> {
  switch (kind) {
    case 'persons':
      return lookupPersons(db, mediaBase, query);
    case 'organizations':
      return lookupOrganizations(db, mediaBase, query);
    case 'bills':
      return lookupBills(db, query);
    case 'categories':
    case 'tags':
      return lookupTaxonomy(db, kind, query);
  }
}

/** Smallest ready WebP variant, or null. */
function thumbnailUrl(row: { status: string | null; variants: MediaVariants | null }, mediaBase: string | undefined): string | null {
  if (row.status !== 'ready' || !row.variants) return null;
  return variantList(row.variants, mediaBase)[0]?.url ?? null;
}

/** `ids` wins over `search`; both narrow the live (not soft-deleted) rows. */
function filters(query: LookupQuery, id: AnyPgColumn, searchable: AnyPgColumn[]): SQL[] {
  if (query.ids) return [inArray(id, query.ids)];
  if (!query.search) return [];
  const pattern = likePattern(query.search);
  return [or(...searchable.map((column) => ilike(column, pattern)))!];
}

async function lookupPersons(db: Db, mediaBase: string | undefined, query: LookupQuery): Promise<LookupItem[]> {
  const rows = await db
    .select({
      id: persons.id,
      givenNameMn: persons.givenNameMn,
      patronymicMn: persons.patronymicMn,
      photo: { status: media.status, variants: media.variants },
    })
    .from(persons)
    .leftJoin(media, and(eq(media.id, persons.photoMediaId), isNull(media.deletedAt)))
    .where(
      and(
        isNull(persons.deletedAt),
        ...filters(query, persons.id, [persons.givenNameMn, persons.patronymicMn, persons.givenNameEn, persons.slug]),
      ),
    )
    .orderBy(asc(persons.givenNameMn), asc(persons.id))
    .limit(query.ids?.length ?? query.limit);

  // Current party (open party position; the most recent wins) as the sublabel.
  const ids = rows.map((row) => row.id);
  const parties =
    ids.length === 0
      ? []
      : await db
          .select({ personId: positions.personId, nameMn: organizations.nameMn, shortNameMn: organizations.shortNameMn })
          .from(positions)
          .innerJoin(organizations, and(eq(organizations.id, positions.organizationId), isNull(organizations.deletedAt)))
          .where(and(inArray(positions.personId, ids), isNull(positions.endDate), eq(organizations.type, 'party')))
          .orderBy(asc(positions.startDate), asc(positions.id));
  const partyOf = new Map(parties.map((p) => [p.personId, p.shortNameMn ?? p.nameMn]));

  return rows.map((row) => ({
    id: row.id,
    label: personDisplayName(row.patronymicMn, row.givenNameMn),
    sublabel: partyOf.get(row.id) ?? null,
    imageUrl: thumbnailUrl(row.photo ?? { status: null, variants: null }, mediaBase),
  }));
}

async function lookupOrganizations(db: Db, mediaBase: string | undefined, query: LookupQuery): Promise<LookupItem[]> {
  const rows = await db
    .select({
      id: organizations.id,
      nameMn: organizations.nameMn,
      shortNameMn: organizations.shortNameMn,
      logo: { status: media.status, variants: media.variants },
    })
    .from(organizations)
    .leftJoin(media, and(eq(media.id, organizations.logoMediaId), isNull(media.deletedAt)))
    .where(
      and(
        isNull(organizations.deletedAt),
        ...filters(query, organizations.id, [organizations.nameMn, organizations.shortNameMn, organizations.nameEn, organizations.slug]),
      ),
    )
    .orderBy(asc(organizations.nameMn), asc(organizations.id))
    .limit(query.ids?.length ?? query.limit);

  return rows.map((row) => ({
    id: row.id,
    label: row.nameMn,
    sublabel: row.shortNameMn,
    imageUrl: thumbnailUrl(row.logo ?? { status: null, variants: null }, mediaBase),
  }));
}

async function lookupBills(db: Db, query: LookupQuery): Promise<LookupItem[]> {
  const rows = await db
    .select({ id: bills.id, titleMn: bills.titleMn, registrationNumber: bills.registrationNumber })
    .from(bills)
    .where(and(...filters(query, bills.id, [bills.titleMn, bills.titleEn, bills.registrationNumber, bills.slug])))
    .orderBy(asc(bills.titleMn), asc(bills.id))
    .limit(query.ids?.length ?? query.limit);
  return rows.map((row) => ({ id: row.id, label: row.titleMn, sublabel: row.registrationNumber, imageUrl: null }));
}

async function lookupTaxonomy(db: Db, kind: 'categories' | 'tags', query: LookupQuery): Promise<LookupItem[]> {
  const table = kind === 'categories' ? categories : tags;
  const rows = await db
    .select({ id: table.id, nameMn: table.nameMn })
    .from(table)
    .where(and(...filters(query, table.id, [table.nameMn, table.nameEn, table.slug])))
    .orderBy(asc(table.nameMn), asc(table.id))
    .limit(query.ids?.length ?? query.limit);
  return rows.map((row) => ({ id: row.id, label: row.nameMn, sublabel: null, imageUrl: null }));
}
