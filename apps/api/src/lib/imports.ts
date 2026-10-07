import { ErrorCode, type ImportResult, type ValidationIssue } from '@news/shared/schemas';
import { and, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { Db, Tx } from '../db/client';
import { AppError } from './errors';

/** Thrown inside the transaction to roll back a dry run while carrying its result out. */
class DryRunRollback extends Error {
  constructor(readonly result: ImportResult) {
    super('dry run rollback');
  }
}

/**
 * Runs an import in one transaction. A dry run executes exactly the same code (including DB constraints and the
 * audit row), then rolls everything back and returns the computed diff.
 */
export async function runImport(db: Db, dryRun: boolean, apply: (tx: Tx) => Promise<ImportResult>): Promise<ImportResult> {
  try {
    return await db.transaction(async (tx) => {
      const result = await apply(tx);
      if (dryRun) throw new DryRunRollback(result);
      return result;
    });
  } catch (err) {
    if (err instanceof DryRunRollback) return err.result;
    throw err;
  }
}

/** Collects per-row problems; `throwIfAny` aborts the import with 400 IMPORT_INVALID before anything is written. */
export class ImportIssues {
  private readonly issues: ValidationIssue[] = [];

  add(row: number, field: string, message: string): void {
    this.issues.push({ path: `rows.${row}.${field}`, message });
  }

  throwIfAny(): void {
    if (this.issues.length === 0) return;
    throw new AppError(400, ErrorCode.IMPORT_INVALID, `${this.issues.length} row problem(s); nothing was imported`, this.issues.slice(0, 200));
  }
}

/** Strips undefined (= "leave unchanged") from an import row's optional fields. */
export function present<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export interface RefTarget {
  table: PgTable;
  id: AnyPgColumn;
  slug: AnyPgColumn;
  /** Soft-deleted rows count as unknown. */
  deletedAt?: AnyPgColumn;
}

export interface Refs {
  byId: Map<number, number>;
  bySlug: Map<string, number>;
}

/** Loads the rows an import references by id or slug (one query per target). */
export async function loadRefs(tx: Tx, target: RefTarget, ids: number[], slugs: string[]): Promise<Refs> {
  const refs: Refs = { byId: new Map(), bySlug: new Map() };
  if (ids.length === 0 && slugs.length === 0) return refs;
  const match: SQL[] = [];
  if (ids.length) match.push(inArray(target.id, [...new Set(ids)]));
  if (slugs.length) match.push(inArray(target.slug, [...new Set(slugs)]));
  const conditions = [or(...match)];
  if (target.deletedAt) conditions.push(isNull(target.deletedAt));
  const rows = (await tx
    .select({ id: target.id, slug: target.slug })
    .from(target.table)
    .where(and(...conditions))) as { id: number; slug: string }[];
  for (const row of rows) {
    refs.byId.set(row.id, row.id);
    refs.bySlug.set(row.slug, row.id);
  }
  return refs;
}

export function resolveRef(refs: Refs, id: number | undefined, slug: string | undefined): number | undefined {
  if (id !== undefined) return refs.byId.get(id);
  if (slug !== undefined) return refs.bySlug.get(slug);
  return undefined;
}

export const idsOf = <T>(rows: T[], pick: (row: T) => number | undefined) => rows.flatMap((r) => (pick(r) === undefined ? [] : [pick(r)!]));
export const slugsOf = <T>(rows: T[], pick: (row: T) => string | undefined) => rows.flatMap((r) => (pick(r) === undefined ? [] : [pick(r)!]));

