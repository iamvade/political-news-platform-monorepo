import { and, eq, ne } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db, Tx } from '../db/client';

export interface SlugTarget {
  table: PgTable;
  id: AnyPgColumn;
  slug: AnyPgColumn;
}

export async function slugExists(db: Db | Tx, target: SlugTarget, slug: string, exceptId?: number): Promise<boolean> {
  const where = exceptId === undefined ? eq(target.slug, slug) : and(eq(target.slug, slug), ne(target.id, exceptId));
  const rows = await db.select({ id: target.id }).from(target.table).where(where).limit(1);
  return rows.length > 0;
}

/** `base`, `base-2`, `base-3`, … — the first one not taken. Soft-deleted rows still hold their slug. */
export async function uniqueSlug(db: Db | Tx, target: SlugTarget, base: string): Promise<string> {
  for (let n = 1; n <= 50; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 75)}-${n}`;
    if (!(await slugExists(db, target, candidate))) return candidate;
  }
  return `${base.slice(0, 70)}-${Date.now().toString(36)}`;
}
