import type { AuthUser, ImportResult, VoteImportBody } from '@news/shared/schemas';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { bills, persons, votes } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { idsOf, ImportIssues, loadRefs, resolveRef, runImport, slugsOf } from '../../lib/imports';

const keyOf = (v: { billId: number; personId: number; date: string; motion: string }) =>
  `${v.billId}|${v.personId}|${v.date}|${v.motion}`;

/** Upserts votes matched on (bill, person, date, motion); `value` and `sourceUrl` are updated. Never deletes. */
export function importVotes(db: Db, user: AuthUser, body: VoteImportBody): Promise<ImportResult> {
  return runImport(db, body.dryRun, async (tx) => {
    const { rows } = body;
    const issues = new ImportIssues();

    const billRefs = await loadRefs(
      tx,
      { table: bills, id: bills.id, slug: bills.slug },
      idsOf(rows, (r) => r.billId),
      slugsOf(rows, (r) => r.billSlug),
    );
    const personRefs = await loadRefs(
      tx,
      { table: persons, id: persons.id, slug: persons.slug, deletedAt: persons.deletedAt },
      idsOf(rows, (r) => r.personId),
      slugsOf(rows, (r) => r.personSlug),
    );

    const resolved = rows.map((row, i) => {
      const billId = resolveRef(billRefs, row.billId, row.billSlug);
      const personId = resolveRef(personRefs, row.personId, row.personSlug);
      if (billId === undefined) issues.add(i, row.billId !== undefined ? 'billId' : 'billSlug', 'Unknown bill');
      if (personId === undefined) issues.add(i, row.personId !== undefined ? 'personId' : 'personSlug', 'Unknown person');
      return { row, key: { billId: billId ?? 0, personId: personId ?? 0, date: row.date, motion: row.motion } };
    });

    const seen = new Map<string, number>();
    resolved.forEach(({ key }, i) => {
      if (!key.billId || !key.personId) return;
      const first = seen.get(keyOf(key));
      if (first !== undefined) issues.add(i, 'motion', `Duplicate of row ${first} (same bill, person, date, motion)`);
      else seen.set(keyOf(key), i);
    });
    issues.throwIfAny();

    const billIds = [...new Set(resolved.map((r) => r.key.billId))];
    const existing = await tx.select().from(votes).where(inArray(votes.billId, billIds));
    const existingByKey = new Map(existing.map((v) => [keyOf(v), v]));

    const result: ImportResult = {
      dryRun: body.dryRun,
      summary: { create: 0, update: 0, unchanged: 0 },
      diff: { create: [], update: [] },
    };
    const toInsert: (typeof votes.$inferInsert)[] = [];
    const updatedIds: number[] = [];

    for (const { row, key } of resolved) {
      const current = existingByKey.get(keyOf(key));
      if (!current) {
        const values = { ...key, value: row.value, sourceUrl: row.sourceUrl };
        toInsert.push(values);
        result.diff.create.push(values);
        continue;
      }
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      if (current.value !== row.value) {
        before.value = current.value;
        after.value = row.value;
      }
      if (current.sourceUrl !== row.sourceUrl) {
        before.sourceUrl = current.sourceUrl;
        after.sourceUrl = row.sourceUrl;
      }
      if (Object.keys(after).length === 0) {
        result.summary.unchanged += 1;
        continue;
      }
      await tx.update(votes).set(after).where(eq(votes.id, current.id));
      updatedIds.push(current.id);
      result.diff.update.push({ key: { id: current.id, ...key }, before, after });
    }

    const inserted = toInsert.length ? await tx.insert(votes).values(toInsert).returning({ id: votes.id }) : [];
    result.summary.create = inserted.length;
    result.summary.update = updatedIds.length;

    await audit(tx, {
      actorId: user.id,
      action: 'import',
      entityType: 'vote',
      entityId: null,
      diff: { summary: result.summary, createdIds: inserted.map((r) => r.id), updatedIds },
    });
    return result;
  });
}
