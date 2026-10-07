import type {
  AdminDeclaration,
  AdminPromise,
  AdminPromiseUpdate,
  AdminStatement,
  AuthUser,
  CreateDeclarationBody,
  CreatePromiseBody,
  CreateStatementBody,
  UpdateDeclarationBody,
  UpdatePromiseBody,
  UpdateStatementBody,
  PaginationQuery,
  PromiseStatusChangeBody,
  declarationListQuerySchema,
  promiseListQuerySchema,
  statementListQuerySchema,
} from '@news/shared/schemas';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db/client';
import { declarations, promises, promiseUpdates, statements } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { assertHasChanges, definedOnly, diffOf, iso, isoOrNull, notFound } from '../../lib/crud';

type Page<T> = { items: T[]; total: number };

// ---------------------------------------------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------------------------------------------

function toAdminStatement(row: typeof statements.$inferSelect): AdminStatement {
  return {
    id: row.id,
    personId: row.personId,
    quoteMn: row.quoteMn,
    contextMn: row.contextMn,
    saidOn: row.saidOn,
    articleId: row.articleId,
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listStatements(db: Db, query: z.infer<typeof statementListQuerySchema>): Promise<Page<AdminStatement>> {
  const conditions: SQL[] = [];
  if (query.personId) conditions.push(eq(statements.personId, query.personId));
  if (query.articleId) conditions.push(eq(statements.articleId, query.articleId));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(statements).where(where);
  const rows = await db
    .select()
    .from(statements)
    .where(where)
    .orderBy(desc(statements.saidOn), desc(statements.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminStatement), total: total?.n ?? 0 };
}

export async function getStatement(db: Db, id: number): Promise<AdminStatement> {
  const [row] = await db.select().from(statements).where(eq(statements.id, id)).limit(1);
  if (!row) throw notFound('Statement');
  return toAdminStatement(row);
}

export async function createStatement(db: Db, user: AuthUser, body: CreateStatementBody): Promise<AdminStatement> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(statements).values(body).returning();
    const dto = toAdminStatement(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'statement', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateStatement(db: Db, user: AuthUser, id: number, body: UpdateStatementBody): Promise<AdminStatement> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(statements).where(eq(statements.id, id)).for('update');
    if (!before) throw notFound('Statement');
    const [after] = await tx.update(statements).set(changes).where(eq(statements.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'statement', entityId: id, diff: diffOf(before, after!) });
    return toAdminStatement(after!);
  });
}

export async function deleteStatement(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(statements).where(eq(statements.id, id)).returning();
    if (!row) throw notFound('Statement');
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'statement', entityId: id, diff: { before: toAdminStatement(row) } });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Promises
// ---------------------------------------------------------------------------------------------------------------

function toAdminPromise(row: typeof promises.$inferSelect): AdminPromise {
  return {
    id: row.id,
    personId: row.personId,
    organizationId: row.organizationId,
    textMn: row.textMn,
    madeOn: row.madeOn,
    status: row.status,
    evidence: row.evidence,
    lastReviewedAt: isoOrNull(row.lastReviewedAt),
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listPromises(db: Db, query: z.infer<typeof promiseListQuerySchema>): Promise<Page<AdminPromise>> {
  const conditions: SQL[] = [];
  if (query.personId) conditions.push(eq(promises.personId, query.personId));
  if (query.organizationId) conditions.push(eq(promises.organizationId, query.organizationId));
  if (query.status) conditions.push(eq(promises.status, query.status));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(promises).where(where);
  const rows = await db
    .select()
    .from(promises)
    .where(where)
    .orderBy(desc(promises.madeOn), desc(promises.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminPromise), total: total?.n ?? 0 };
}

export async function getPromise(db: Db, id: number): Promise<AdminPromise> {
  const [row] = await db.select().from(promises).where(eq(promises.id, id)).limit(1);
  if (!row) throw notFound('Promise');
  return toAdminPromise(row);
}

/** `lastReviewedAt` arrives as an ISO string; the column is a timestamp. */
function promiseValues<T extends { lastReviewedAt?: string | null }>(body: T) {
  const { lastReviewedAt, ...rest } = body;
  return {
    ...rest,
    ...(lastReviewedAt !== undefined && { lastReviewedAt: lastReviewedAt === null ? null : new Date(lastReviewedAt) }),
  };
}

export async function createPromise(db: Db, user: AuthUser, body: CreatePromiseBody): Promise<AdminPromise> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(promises).values(promiseValues(body)).returning();
    const dto = toAdminPromise(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'promise', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updatePromise(db: Db, user: AuthUser, id: number, body: UpdatePromiseBody): Promise<AdminPromise> {
  const changes = definedOnly(promiseValues(body));
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(promises).where(eq(promises.id, id)).for('update');
    if (!before) throw notFound('Promise');
    const [after] = await tx.update(promises).set(changes).where(eq(promises.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'promise', entityId: id, diff: diffOf(before, after!) });
    return toAdminPromise(after!);
  });
}

function toAdminPromiseUpdate(row: typeof promiseUpdates.$inferSelect): AdminPromiseUpdate {
  return {
    id: row.id,
    promiseId: row.promiseId,
    status: row.status,
    date: row.date,
    noteMn: row.noteMn,
    sourceUrl: row.sourceUrl,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
  };
}

/**
 * The only way to change a promise's status: records the dated decision (note + evidence URL) and mirrors the
 * status on the promise. The same status is allowed — that records a review that confirmed it.
 */
export async function changePromiseStatus(db: Db, user: AuthUser, id: number, body: PromiseStatusChangeBody): Promise<AdminPromise> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(promises).where(eq(promises.id, id)).for('update');
    if (!before) throw notFound('Promise');
    const [update] = await tx
      .insert(promiseUpdates)
      .values({ promiseId: id, status: body.status, date: body.date, noteMn: body.noteMn, sourceUrl: body.sourceUrl, createdBy: user.id })
      .returning();
    const [after] = await tx.update(promises).set({ status: body.status, lastReviewedAt: new Date() }).where(eq(promises.id, id)).returning();
    await audit(tx, {
      actorId: user.id,
      action: 'update',
      entityType: 'promise',
      entityId: id,
      diff: { ...diffOf(before, after!), promiseUpdate: toAdminPromiseUpdate(update!) },
    });
    return toAdminPromise(after!);
  });
}

/** Status history, newest first. */
export async function listPromiseUpdates(db: Db, id: number, query: PaginationQuery): Promise<Page<AdminPromiseUpdate>> {
  await getPromise(db, id); // 404 for an unknown promise
  const where = eq(promiseUpdates.promiseId, id);
  const [total] = await db.select({ n: count() }).from(promiseUpdates).where(where);
  const rows = await db
    .select()
    .from(promiseUpdates)
    .where(where)
    .orderBy(desc(promiseUpdates.date), desc(promiseUpdates.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminPromiseUpdate), total: total?.n ?? 0 };
}

export async function deletePromise(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(promises).where(eq(promises.id, id)).returning();
    if (!row) throw notFound('Promise');
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'promise', entityId: id, diff: { before: toAdminPromise(row) } });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Declarations
// ---------------------------------------------------------------------------------------------------------------

function toAdminDeclaration(row: typeof declarations.$inferSelect): AdminDeclaration {
  return {
    id: row.id,
    personId: row.personId,
    year: row.year,
    filedOn: row.filedOn,
    income: row.income,
    assets: row.assets,
    liabilities: row.liabilities,
    details: row.details,
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listDeclarations(
  db: Db,
  query: z.infer<typeof declarationListQuerySchema>,
): Promise<Page<AdminDeclaration>> {
  const conditions: SQL[] = [];
  if (query.personId) conditions.push(eq(declarations.personId, query.personId));
  if (query.year) conditions.push(eq(declarations.year, query.year));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(declarations).where(where);
  const rows = await db
    .select()
    .from(declarations)
    .where(where)
    .orderBy(desc(declarations.year), desc(declarations.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminDeclaration), total: total?.n ?? 0 };
}

export async function getDeclaration(db: Db, id: number): Promise<AdminDeclaration> {
  const [row] = await db.select().from(declarations).where(eq(declarations.id, id)).limit(1);
  if (!row) throw notFound('Declaration');
  return toAdminDeclaration(row);
}

export async function createDeclaration(db: Db, user: AuthUser, body: CreateDeclarationBody): Promise<AdminDeclaration> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(declarations).values(body).returning();
    const dto = toAdminDeclaration(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'declaration', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateDeclaration(
  db: Db,
  user: AuthUser,
  id: number,
  body: UpdateDeclarationBody,
): Promise<AdminDeclaration> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(declarations).where(eq(declarations.id, id)).for('update');
    if (!before) throw notFound('Declaration');
    const [after] = await tx.update(declarations).set(changes).where(eq(declarations.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'declaration', entityId: id, diff: diffOf(before, after!) });
    return toAdminDeclaration(after!);
  });
}

export async function deleteDeclaration(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(declarations).where(eq(declarations.id, id)).returning();
    if (!row) throw notFound('Declaration');
    await audit(tx, {
      actorId: user.id,
      action: 'delete',
      entityType: 'declaration',
      entityId: id,
      diff: { before: toAdminDeclaration(row) },
    });
  });
}
