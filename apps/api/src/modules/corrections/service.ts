import type {
  AdminCorrection,
  AuthUser,
  CreateCorrectionBody,
  UpdateCorrectionBody,
  correctionListQuerySchema,
} from '@news/shared/schemas';
import { and, count, desc, eq, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../../db/client';
import { corrections } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { assertHasChanges, definedOnly, diffOf, iso, notFound } from '../../lib/crud';

function toAdminCorrection(row: typeof corrections.$inferSelect): AdminCorrection {
  return {
    id: row.id,
    entityType: row.entityType,
    entityId: row.entityId,
    date: row.date,
    description: row.description,
    reason: row.reason,
    createdBy: row.createdBy,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listCorrections(
  db: Db,
  query: z.infer<typeof correctionListQuerySchema>,
): Promise<{ items: AdminCorrection[]; total: number }> {
  const conditions: SQL[] = [];
  if (query.entityType) conditions.push(eq(corrections.entityType, query.entityType));
  if (query.entityId) conditions.push(eq(corrections.entityId, query.entityId));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(corrections).where(where);
  const rows = await db
    .select()
    .from(corrections)
    .where(where)
    .orderBy(desc(corrections.date), desc(corrections.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminCorrection), total: total?.n ?? 0 };
}

export async function getCorrection(db: Db, id: number): Promise<AdminCorrection> {
  const [row] = await db.select().from(corrections).where(eq(corrections.id, id)).limit(1);
  if (!row) throw notFound('Correction');
  return toAdminCorrection(row);
}

export async function createCorrection(db: Db, user: AuthUser, body: CreateCorrectionBody): Promise<AdminCorrection> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(corrections)
      .values({ ...body, createdBy: user.id })
      .returning();
    const dto = toAdminCorrection(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'correction', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateCorrection(
  db: Db,
  user: AuthUser,
  id: number,
  body: UpdateCorrectionBody,
): Promise<AdminCorrection> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(corrections).where(eq(corrections.id, id)).for('update');
    if (!before) throw notFound('Correction');
    const [after] = await tx.update(corrections).set(changes).where(eq(corrections.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'correction', entityId: id, diff: diffOf(before, after!) });
    return toAdminCorrection(after!);
  });
}

export async function deleteCorrection(db: Db, user: AuthUser, id: number): Promise<AdminCorrection> {
  return db.transaction(async (tx) => {
    const [row] = await tx.delete(corrections).where(eq(corrections.id, id)).returning();
    if (!row) throw notFound('Correction');
    await audit(tx, {
      actorId: user.id,
      action: 'delete',
      entityType: 'correction',
      entityId: id,
      diff: { before: toAdminCorrection(row) },
    });
    return toAdminCorrection(row);
  });
}
