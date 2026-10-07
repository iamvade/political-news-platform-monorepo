import {
  ErrorCode,
  personDisplayName,
  type AdminOrganization,
  type AdminPerson,
  type AdminPosition,
  type AuthUser,
  type CreateOrganizationBody,
  type CreatePersonBody,
  type CreatePositionBody,
  type UpdateOrganizationBody,
  type UpdatePersonBody,
  type UpdatePositionBody,
} from '@news/shared/schemas';
import { slugify } from '@news/shared/translit';
import type { z } from 'zod';
import type { organizationListQuerySchema, personListQuerySchema, positionListQuerySchema } from '@news/shared/schemas';
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { organizations, persons, positions } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { assertHasChanges, definedOnly, diffOf, iso, isoOrNull, likePattern, notFound } from '../../lib/crud';
import { AppError } from '../../lib/errors';
import { uniqueSlug } from '../../lib/slugs';

type PersonRow = typeof persons.$inferSelect;
type OrganizationRow = typeof organizations.$inferSelect;
type PositionRow = typeof positions.$inferSelect;
type Page<T> = { items: T[]; total: number };

const PERSON_SLUGS = { table: persons, id: persons.id, slug: persons.slug };
const ORGANIZATION_SLUGS = { table: organizations, id: organizations.id, slug: organizations.slug };

function assertCanIncludeDeleted(user: AuthUser, includeDeleted: boolean | undefined): void {
  if (includeDeleted && user.role !== 'admin') {
    throw new AppError(403, ErrorCode.FORBIDDEN, 'Only admins can list deleted records');
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Persons
// ---------------------------------------------------------------------------------------------------------------

export function toAdminPerson(row: PersonRow): AdminPerson {
  return {
    id: row.id,
    slug: row.slug,
    displayName: personDisplayName(row.patronymicMn, row.givenNameMn),
    givenNameMn: row.givenNameMn,
    patronymicMn: row.patronymicMn,
    givenNameEn: row.givenNameEn,
    patronymicEn: row.patronymicEn,
    birthDate: row.birthDate,
    gender: row.gender,
    photoMediaId: row.photoMediaId,
    bioMn: row.bioMn,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: isoOrNull(row.deletedAt),
  };
}

export async function listPersons(
  db: Db,
  user: AuthUser,
  query: z.infer<typeof personListQuerySchema>,
): Promise<Page<AdminPerson>> {
  assertCanIncludeDeleted(user, query.includeDeleted);
  const conditions: SQL[] = [];
  if (!query.includeDeleted) conditions.push(isNull(persons.deletedAt));
  if (query.search) {
    const pattern = likePattern(query.search);
    conditions.push(
      or(
        ilike(persons.givenNameMn, pattern),
        ilike(persons.patronymicMn, pattern),
        ilike(persons.givenNameEn, pattern),
        ilike(persons.slug, pattern),
      )!,
    );
  }
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(persons).where(where);
  const rows = await db
    .select()
    .from(persons)
    .where(where)
    .orderBy(asc(persons.givenNameMn), asc(persons.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminPerson), total: total?.n ?? 0 };
}

async function findPerson(db: Db, id: number): Promise<PersonRow> {
  const [row] = await db
    .select()
    .from(persons)
    .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Person');
  return row;
}

export async function getPerson(db: Db, id: number): Promise<AdminPerson> {
  return toAdminPerson(await findPerson(db, id));
}

export async function createPerson(db: Db, user: AuthUser, body: CreatePersonBody): Promise<AdminPerson> {
  return db.transaction(async (tx) => {
    const slug =
      body.slug ?? (await uniqueSlug(tx, PERSON_SLUGS, slugify(`${Array.from(body.patronymicMn)[0] ?? ''} ${body.givenNameMn}`, 'person')));
    const [row] = await tx
      .insert(persons)
      .values({ ...body, slug })
      .returning();
    const dto = toAdminPerson(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'person', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updatePerson(db: Db, user: AuthUser, id: number, body: UpdatePersonBody): Promise<AdminPerson> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(persons)
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .for('update');
    if (!before) throw notFound('Person');
    const [after] = await tx.update(persons).set(changes).where(eq(persons.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'person', entityId: id, diff: diffOf(before, after!) });
    return toAdminPerson(after!);
  });
}

/** Soft delete: the profile disappears from lists and the public site; history rows stay. */
export async function deletePerson(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(persons)
      .set({ deletedAt: new Date() })
      .where(and(eq(persons.id, id), isNull(persons.deletedAt)))
      .returning({ id: persons.id, slug: persons.slug });
    if (!row) throw notFound('Person');
    await audit(tx, { actorId: user.id, action: 'soft_delete', entityType: 'person', entityId: id, diff: { slug: row.slug } });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------------------------------------------

export function toAdminOrganization(row: OrganizationRow): AdminOrganization {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    nameMn: row.nameMn,
    nameEn: row.nameEn,
    shortNameMn: row.shortNameMn,
    parentId: row.parentId,
    color: row.color,
    logoMediaId: row.logoMediaId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    deletedAt: isoOrNull(row.deletedAt),
  };
}

export async function listOrganizations(
  db: Db,
  user: AuthUser,
  query: z.infer<typeof organizationListQuerySchema>,
): Promise<Page<AdminOrganization>> {
  assertCanIncludeDeleted(user, query.includeDeleted);
  const conditions: SQL[] = [];
  if (!query.includeDeleted) conditions.push(isNull(organizations.deletedAt));
  if (query.type) conditions.push(eq(organizations.type, query.type));
  if (query.parentId) conditions.push(eq(organizations.parentId, query.parentId));
  if (query.search) {
    const pattern = likePattern(query.search);
    conditions.push(
      or(ilike(organizations.nameMn, pattern), ilike(organizations.shortNameMn, pattern), ilike(organizations.slug, pattern))!,
    );
  }
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(organizations).where(where);
  const rows = await db
    .select()
    .from(organizations)
    .where(where)
    .orderBy(asc(organizations.type), asc(organizations.nameMn), asc(organizations.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminOrganization), total: total?.n ?? 0 };
}

export async function getOrganization(db: Db, id: number): Promise<AdminOrganization> {
  const [row] = await db
    .select()
    .from(organizations)
    .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Organization');
  return toAdminOrganization(row);
}

export async function createOrganization(db: Db, user: AuthUser, body: CreateOrganizationBody): Promise<AdminOrganization> {
  return db.transaction(async (tx) => {
    const slug = body.slug ?? (await uniqueSlug(tx, ORGANIZATION_SLUGS, slugify(body.nameEn ?? body.nameMn, 'organization')));
    const [row] = await tx
      .insert(organizations)
      .values({ ...body, slug })
      .returning();
    const dto = toAdminOrganization(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'organization', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateOrganization(
  db: Db,
  user: AuthUser,
  id: number,
  body: UpdateOrganizationBody,
): Promise<AdminOrganization> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  if (changes.parentId === id) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'An organization cannot be its own parent');
  return db.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(organizations)
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .for('update');
    if (!before) throw notFound('Organization');
    const [after] = await tx.update(organizations).set(changes).where(eq(organizations.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: 'update',
      entityType: 'organization',
      entityId: id,
      diff: diffOf(before, after!),
    });
    return toAdminOrganization(after!);
  });
}

export async function deleteOrganization(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(and(eq(organizations.id, id), isNull(organizations.deletedAt)))
      .returning({ id: organizations.id, slug: organizations.slug });
    if (!row) throw notFound('Organization');
    await audit(tx, {
      actorId: user.id,
      action: 'soft_delete',
      entityType: 'organization',
      entityId: id,
      diff: { slug: row.slug },
    });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------------------------------------------

export function toAdminPosition(row: PositionRow): AdminPosition {
  return {
    id: row.id,
    personId: row.personId,
    organizationId: row.organizationId,
    titleMn: row.titleMn,
    titleEn: row.titleEn,
    startDate: row.startDate,
    endDate: row.endDate,
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listPositions(db: Db, query: z.infer<typeof positionListQuerySchema>): Promise<Page<AdminPosition>> {
  const conditions: SQL[] = [];
  if (query.personId) conditions.push(eq(positions.personId, query.personId));
  if (query.organizationId) conditions.push(eq(positions.organizationId, query.organizationId));
  if (query.current === true) conditions.push(isNull(positions.endDate));
  if (query.current === false) conditions.push(isNotNull(positions.endDate));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(positions).where(where);
  const rows = await db
    .select()
    .from(positions)
    .where(where)
    .orderBy(desc(positions.startDate), desc(positions.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminPosition), total: total?.n ?? 0 };
}

export async function getPosition(db: Db, id: number): Promise<AdminPosition> {
  const [row] = await db.select().from(positions).where(eq(positions.id, id)).limit(1);
  if (!row) throw notFound('Position');
  return toAdminPosition(row);
}

export async function createPosition(db: Db, user: AuthUser, body: CreatePositionBody): Promise<AdminPosition> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(positions).values(body).returning();
    const dto = toAdminPosition(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'position', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updatePosition(db: Db, user: AuthUser, id: number, body: UpdatePositionBody): Promise<AdminPosition> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(positions).where(eq(positions.id, id)).for('update');
    if (!before) throw notFound('Position');
    const [after] = await tx.update(positions).set(changes).where(eq(positions.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'position', entityId: id, diff: diffOf(before, after!) });
    return toAdminPosition(after!);
  });
}

/** Hard delete (admin only, audited). */
export async function deletePosition(db: Db, user: AuthUser, id: number): Promise<AdminPosition> {
  return db.transaction(async (tx) => {
    const [row] = await tx.delete(positions).where(eq(positions.id, id)).returning();
    if (!row) throw notFound('Position');
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'position', entityId: id, diff: { before: toAdminPosition(row) } });
    return toAdminPosition(row);
  });
}
