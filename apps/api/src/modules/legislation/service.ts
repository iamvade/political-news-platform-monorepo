import type {
  AdminBill,
  AdminBillStage,
  AdminVote,
  AuthUser,
  CreateBillBody,
  CreateBillStageBody,
  CreateVoteBody,
  ReplaceSponsorsBody,
  UpdateBillBody,
  UpdateBillStageBody,
  UpdateVoteBody,
  billListQuerySchema,
  billStageListQuerySchema,
  voteListQuerySchema,
} from '@news/shared/schemas';
import { slugify } from '@news/shared/translit';
import { and, asc, count, desc, eq, ilike, inArray, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db, Tx } from '../../db/client';
import { billSponsors, billStages, bills, votes } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { assertHasChanges, definedOnly, diffOf, iso, likePattern, notFound } from '../../lib/crud';
import { uniqueSlug } from '../../lib/slugs';

type BillRow = typeof bills.$inferSelect;
type StageRow = typeof billStages.$inferSelect;
type VoteRow = typeof votes.$inferSelect;
type Sponsor = AdminBill['sponsors'][number];
type Page<T> = { items: T[]; total: number };

const BILL_SLUGS = { table: bills, id: bills.id, slug: bills.slug };

// ---------------------------------------------------------------------------------------------------------------
// Bills
// ---------------------------------------------------------------------------------------------------------------

function toAdminBill(row: BillRow, sponsors: Sponsor[]): AdminBill {
  return {
    id: row.id,
    slug: row.slug,
    titleMn: row.titleMn,
    titleEn: row.titleEn,
    registrationNumber: row.registrationNumber,
    initiatorType: row.initiatorType,
    status: row.status,
    submittedOn: row.submittedOn,
    sourceUrl: row.sourceUrl,
    sponsors,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function sponsorsFor(db: Db | Tx, billIds: number[]): Promise<Map<number, Sponsor[]>> {
  const map = new Map<number, Sponsor[]>();
  if (billIds.length === 0) return map;
  const rows = await db
    .select({ billId: billSponsors.billId, personId: billSponsors.personId, role: billSponsors.role })
    .from(billSponsors)
    .where(inArray(billSponsors.billId, billIds))
    .orderBy(asc(billSponsors.role), asc(billSponsors.personId));
  for (const row of rows) {
    const list = map.get(row.billId) ?? [];
    list.push({ personId: row.personId, role: row.role });
    map.set(row.billId, list);
  }
  return map;
}

export async function listBills(db: Db, query: z.infer<typeof billListQuerySchema>): Promise<Page<AdminBill>> {
  const conditions: SQL[] = [];
  if (query.status) conditions.push(eq(bills.status, query.status));
  if (query.search) {
    const pattern = likePattern(query.search);
    conditions.push(or(ilike(bills.titleMn, pattern), ilike(bills.registrationNumber, pattern), ilike(bills.slug, pattern))!);
  }
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(bills).where(where);
  const rows = await db
    .select()
    .from(bills)
    .where(where)
    .orderBy(desc(bills.submittedOn), desc(bills.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  const sponsors = await sponsorsFor(db, rows.map((r) => r.id));
  return { items: rows.map((r) => toAdminBill(r, sponsors.get(r.id) ?? [])), total: total?.n ?? 0 };
}

export async function getBill(db: Db | Tx, id: number): Promise<AdminBill> {
  const [row] = await db.select().from(bills).where(eq(bills.id, id)).limit(1);
  if (!row) throw notFound('Bill');
  const sponsors = await sponsorsFor(db, [id]);
  return toAdminBill(row, sponsors.get(id) ?? []);
}

export async function createBill(db: Db, user: AuthUser, body: CreateBillBody): Promise<AdminBill> {
  return db.transaction(async (tx) => {
    const slug = body.slug ?? (await uniqueSlug(tx, BILL_SLUGS, slugify(body.titleEn ?? body.titleMn, 'bill')));
    const [row] = await tx
      .insert(bills)
      .values({ ...body, slug })
      .returning();
    const dto = toAdminBill(row!, []);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'bill', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateBill(db: Db, user: AuthUser, id: number, body: UpdateBillBody): Promise<AdminBill> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(bills).where(eq(bills.id, id)).for('update');
    if (!before) throw notFound('Bill');
    const [after] = await tx.update(bills).set(changes).where(eq(bills.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'bill', entityId: id, diff: diffOf(before, after!) });
    return getBill(tx, id);
  });
}

/** Replaces the whole sponsor list. */
export async function replaceSponsors(db: Db, user: AuthUser, id: number, body: ReplaceSponsorsBody): Promise<AdminBill> {
  return db.transaction(async (tx) => {
    const [bill] = await tx.select({ id: bills.id }).from(bills).where(eq(bills.id, id)).for('update');
    if (!bill) throw notFound('Bill');
    const before = (await sponsorsFor(tx, [id])).get(id) ?? [];
    await tx.delete(billSponsors).where(eq(billSponsors.billId, id));
    if (body.sponsors.length) {
      await tx.insert(billSponsors).values(body.sponsors.map((s) => ({ billId: id, personId: s.personId, role: s.role })));
    }
    await audit(tx, {
      actorId: user.id,
      action: 'update',
      entityType: 'bill',
      entityId: id,
      diff: { sponsors: { from: before, to: body.sponsors } },
    });
    return getBill(tx, id);
  });
}

/** Hard delete (admin only). Stages, sponsors and article links cascade; recorded votes block it (409 IN_USE). */
export async function deleteBill(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await getBill(tx, id);
    await tx.delete(bills).where(eq(bills.id, id));
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'bill', entityId: id, diff: { before } });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Bill stages
// ---------------------------------------------------------------------------------------------------------------

function toAdminStage(row: StageRow): AdminBillStage {
  return {
    id: row.id,
    billId: row.billId,
    stage: row.stage,
    date: row.date,
    noteMn: row.noteMn,
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listStages(db: Db, query: z.infer<typeof billStageListQuerySchema>): Promise<Page<AdminBillStage>> {
  const where = query.billId ? eq(billStages.billId, query.billId) : undefined;
  const [total] = await db.select({ n: count() }).from(billStages).where(where);
  const rows = await db
    .select()
    .from(billStages)
    .where(where)
    .orderBy(asc(billStages.billId), asc(billStages.date), asc(billStages.id))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminStage), total: total?.n ?? 0 };
}

export async function getStage(db: Db, id: number): Promise<AdminBillStage> {
  const [row] = await db.select().from(billStages).where(eq(billStages.id, id)).limit(1);
  if (!row) throw notFound('Bill stage');
  return toAdminStage(row);
}

export async function createStage(db: Db, user: AuthUser, body: CreateBillStageBody): Promise<AdminBillStage> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(billStages).values(body).returning();
    const dto = toAdminStage(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'bill_stage', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateStage(db: Db, user: AuthUser, id: number, body: UpdateBillStageBody): Promise<AdminBillStage> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(billStages).where(eq(billStages.id, id)).for('update');
    if (!before) throw notFound('Bill stage');
    const [after] = await tx.update(billStages).set(changes).where(eq(billStages.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'bill_stage', entityId: id, diff: diffOf(before, after!) });
    return toAdminStage(after!);
  });
}

export async function deleteStage(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(billStages).where(eq(billStages.id, id)).returning();
    if (!row) throw notFound('Bill stage');
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'bill_stage', entityId: id, diff: { before: toAdminStage(row) } });
  });
}

// ---------------------------------------------------------------------------------------------------------------
// Votes
// ---------------------------------------------------------------------------------------------------------------

export function toAdminVote(row: VoteRow): AdminVote {
  return {
    id: row.id,
    billId: row.billId,
    personId: row.personId,
    value: row.value,
    date: row.date,
    motion: row.motion,
    sourceUrl: row.sourceUrl,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export async function listVotes(db: Db, query: z.infer<typeof voteListQuerySchema>): Promise<Page<AdminVote>> {
  const conditions: SQL[] = [];
  if (query.billId) conditions.push(eq(votes.billId, query.billId));
  if (query.personId) conditions.push(eq(votes.personId, query.personId));
  if (query.date) conditions.push(eq(votes.date, query.date));
  if (query.motion) conditions.push(eq(votes.motion, query.motion));
  const where = and(...conditions);
  const [total] = await db.select({ n: count() }).from(votes).where(where);
  const rows = await db
    .select()
    .from(votes)
    .where(where)
    .orderBy(desc(votes.date), asc(votes.billId), asc(votes.motion), asc(votes.personId))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);
  return { items: rows.map(toAdminVote), total: total?.n ?? 0 };
}

export async function getVote(db: Db, id: number): Promise<AdminVote> {
  const [row] = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
  if (!row) throw notFound('Vote');
  return toAdminVote(row);
}

export async function createVote(db: Db, user: AuthUser, body: CreateVoteBody): Promise<AdminVote> {
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(votes).values(body).returning();
    const dto = toAdminVote(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'vote', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}

export async function updateVote(db: Db, user: AuthUser, id: number, body: UpdateVoteBody): Promise<AdminVote> {
  const changes = definedOnly(body);
  assertHasChanges(changes);
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(votes).where(eq(votes.id, id)).for('update');
    if (!before) throw notFound('Vote');
    const [after] = await tx.update(votes).set(changes).where(eq(votes.id, id)).returning();
    await audit(tx, { actorId: user.id, action: 'update', entityType: 'vote', entityId: id, diff: diffOf(before, after!) });
    return toAdminVote(after!);
  });
}

export async function deleteVote(db: Db, user: AuthUser, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx.delete(votes).where(eq(votes.id, id)).returning();
    if (!row) throw notFound('Vote');
    await audit(tx, { actorId: user.id, action: 'delete', entityType: 'vote', entityId: id, diff: { before: toAdminVote(row) } });
  });
}
