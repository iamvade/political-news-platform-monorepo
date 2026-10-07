import type { AuthUser, ImportResult, PositionImportBody } from '@news/shared/schemas';
import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { organizations, persons, positions } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { idsOf, ImportIssues, loadRefs, resolveRef, runImport, slugsOf } from '../../lib/imports';

const keyOf = (p: { personId: number; organizationId: number; titleMn: string; startDate: string }) =>
  `${p.personId}|${p.organizationId}|${p.titleMn}|${p.startDate}`;

/**
 * Upserts positions matched on (person, organization, title_mn, start_date). Optional fields left out of a row
 * are not changed; explicit null clears them. Never deletes.
 */
export function importPositions(db: Db, user: AuthUser, body: PositionImportBody): Promise<ImportResult> {
  return runImport(db, body.dryRun, async (tx) => {
    const { rows } = body;
    const issues = new ImportIssues();

    const personRefs = await loadRefs(
      tx,
      { table: persons, id: persons.id, slug: persons.slug, deletedAt: persons.deletedAt },
      idsOf(rows, (r) => r.personId),
      slugsOf(rows, (r) => r.personSlug),
    );
    const orgRefs = await loadRefs(
      tx,
      { table: organizations, id: organizations.id, slug: organizations.slug, deletedAt: organizations.deletedAt },
      idsOf(rows, (r) => r.organizationId),
      slugsOf(rows, (r) => r.organizationSlug),
    );

    const resolved = rows.map((row, i) => {
      const personId = resolveRef(personRefs, row.personId, row.personSlug);
      const organizationId = resolveRef(orgRefs, row.organizationId, row.organizationSlug);
      if (personId === undefined) issues.add(i, row.personId !== undefined ? 'personId' : 'personSlug', 'Unknown person');
      if (organizationId === undefined) {
        issues.add(i, row.organizationId !== undefined ? 'organizationId' : 'organizationSlug', 'Unknown organization');
      }
      return { row, personId: personId ?? 0, organizationId: organizationId ?? 0 };
    });

    const seen = new Map<string, number>();
    resolved.forEach(({ row, personId, organizationId }, i) => {
      if (!personId || !organizationId) return;
      const key = keyOf({ personId, organizationId, titleMn: row.titleMn, startDate: row.startDate });
      const first = seen.get(key);
      if (first !== undefined) issues.add(i, 'startDate', `Duplicate of row ${first} (same person, organization, title, start date)`);
      else seen.set(key, i);
    });
    issues.throwIfAny();

    const personIds = [...new Set(resolved.map((r) => r.personId))];
    const existing = await tx.select().from(positions).where(inArray(positions.personId, personIds));
    const existingByKey = new Map(existing.map((p) => [keyOf(p), p]));

    const result: ImportResult = {
      dryRun: body.dryRun,
      summary: { create: 0, update: 0, unchanged: 0 },
      diff: { create: [], update: [] },
    };
    const toInsert: (typeof positions.$inferInsert)[] = [];
    const updatedIds: number[] = [];

    for (const { row, personId, organizationId } of resolved) {
      const key = { personId, organizationId, titleMn: row.titleMn, startDate: row.startDate };
      const current = existingByKey.get(keyOf(key));
      if (!current) {
        const values = {
          ...key,
          titleEn: row.titleEn ?? null,
          endDate: row.endDate ?? null,
          sourceUrl: row.sourceUrl,
        };
        toInsert.push(values);
        result.diff.create.push(values);
        continue;
      }

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const candidate = { titleEn: row.titleEn, endDate: row.endDate, sourceUrl: row.sourceUrl };
      for (const [field, value] of Object.entries(candidate)) {
        if (value === undefined) continue;
        const old = current[field as keyof typeof candidate] ?? null;
        if (old !== value) {
          before[field] = old;
          after[field] = value;
        }
      }
      if (Object.keys(after).length === 0) {
        result.summary.unchanged += 1;
        continue;
      }
      await tx.update(positions).set(after).where(eq(positions.id, current.id));
      updatedIds.push(current.id);
      result.diff.update.push({ key: { id: current.id, ...key }, before, after });
    }

    const inserted = toInsert.length ? await tx.insert(positions).values(toInsert).returning({ id: positions.id }) : [];
    result.summary.create = inserted.length;
    result.summary.update = updatedIds.length;

    await audit(tx, {
      actorId: user.id,
      action: 'import',
      entityType: 'position',
      entityId: null,
      diff: { summary: result.summary, createdIds: inserted.map((r) => r.id), updatedIds },
    });
    return result;
  });
}
