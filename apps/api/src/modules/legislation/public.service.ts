import { ErrorCode, personDisplayName, type PublicBill, type VoteValue } from '@news/shared/schemas';
import { and, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { billSponsors, billStages, bills, persons, votes } from '../../db/schema/index';
import { AppError } from '../../lib/errors';

const personColumns = { slug: persons.slug, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn };

function personRef(row: { slug: string; givenNameMn: string; patronymicMn: string }) {
  return { ...row, displayName: personDisplayName(row.patronymicMn, row.givenNameMn) };
}

/** Bill with sponsors, stages (oldest first) and votes grouped by (date, motion) with tallies. */
export async function getBillDetail(db: Db, slug: string): Promise<PublicBill> {
  const [bill] = await db.select().from(bills).where(eq(bills.slug, slug)).limit(1);
  if (!bill) throw new AppError(404, ErrorCode.NOT_FOUND, 'Bill not found');

  const [sponsorRows, stageRows, voteRows] = await Promise.all([
    db
      .select({ person: personColumns, role: billSponsors.role })
      .from(billSponsors)
      .innerJoin(persons, and(eq(persons.id, billSponsors.personId), isNull(persons.deletedAt)))
      .where(eq(billSponsors.billId, bill.id))
      .orderBy(asc(billSponsors.role), asc(persons.givenNameMn)),
    db
      .select({ stage: billStages.stage, date: billStages.date, noteMn: billStages.noteMn, sourceUrl: billStages.sourceUrl })
      .from(billStages)
      .where(eq(billStages.billId, bill.id))
      .orderBy(asc(billStages.date), asc(billStages.id)),
    db
      .select({ person: personColumns, value: votes.value, date: votes.date, motion: votes.motion, sourceUrl: votes.sourceUrl })
      .from(votes)
      .innerJoin(persons, and(eq(persons.id, votes.personId), isNull(persons.deletedAt)))
      .where(eq(votes.billId, bill.id))
      .orderBy(asc(votes.date), asc(votes.motion), asc(persons.givenNameMn), asc(persons.id)),
  ]);

  const groups = new Map<string, PublicBill['votes'][number]>();
  for (const row of voteRows) {
    const key = `${row.date}|${row.motion}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        date: row.date,
        motion: row.motion,
        sourceUrl: row.sourceUrl,
        tally: { yes: 0, no: 0, abstain: 0, absent: 0 },
        votes: [],
      };
      groups.set(key, group);
    }
    group.tally[row.value as VoteValue] += 1;
    group.votes.push({ person: personRef(row.person), value: row.value });
  }

  return {
    slug: bill.slug,
    titleMn: bill.titleMn,
    titleEn: bill.titleEn,
    registrationNumber: bill.registrationNumber,
    initiatorType: bill.initiatorType,
    status: bill.status,
    submittedOn: bill.submittedOn,
    sourceUrl: bill.sourceUrl,
    sponsors: sponsorRows.map((s) => ({ person: personRef(s.person), role: s.role })),
    stages: stageRows,
    votes: [...groups.values()],
  };
}
