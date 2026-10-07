import { ErrorCode, personDisplayName, type PublicBill, type PublicParliamentWeek, type VoteValue } from '@news/shared/schemas';
import { and, asc, between, count, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { billSponsors, billStages, bills, persons, votes } from '../../db/schema/index';
import { AppError } from '../../lib/errors';

const personColumns = { id: persons.id, slug: persons.slug, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn };

function personRef(row: { id: number; slug: string; givenNameMn: string; patronymicMn: string }) {
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

const UB_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ulaanbaatar', year: 'numeric', month: '2-digit', day: '2-digit' });

/** `YYYY-MM-DD` shifted by `days` (calendar arithmetic, no time zone involved). */
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Last 7 calendar days in Ulaanbaatar, today included. */
export function parliamentWeekWindow(now: Date): { from: string; to: string } {
  const to = UB_DATE.format(now);
  return { from: addDays(to, -6), to };
}

/** Bill stage changes and roll calls (tallied per bill, date and motion) in the last 7 days, newest first. */
export async function getParliamentWeek(db: Db, now = new Date()): Promise<PublicParliamentWeek> {
  const { from, to } = parliamentWeekWindow(now);
  const bill = { slug: bills.slug, titleMn: bills.titleMn };

  const [stageRows, voteRows] = await Promise.all([
    db
      .select({ bill, stage: billStages.stage, date: billStages.date, noteMn: billStages.noteMn, sourceUrl: billStages.sourceUrl })
      .from(billStages)
      .innerJoin(bills, eq(bills.id, billStages.billId))
      .where(between(billStages.date, from, to))
      .orderBy(desc(billStages.date), desc(billStages.id)),
    db
      .select({
        billId: votes.billId,
        bill,
        date: votes.date,
        motion: votes.motion,
        value: votes.value,
        n: count(),
        sourceUrl: sql<string>`min(${votes.sourceUrl})`,
      })
      .from(votes)
      .innerJoin(bills, eq(bills.id, votes.billId))
      // Same rule as the bill page: votes of soft-deleted persons are not counted.
      .innerJoin(persons, and(eq(persons.id, votes.personId), isNull(persons.deletedAt)))
      .where(between(votes.date, from, to))
      .groupBy(votes.billId, bills.slug, bills.titleMn, votes.date, votes.motion, votes.value),
  ]);

  const sessions = new Map<string, PublicParliamentWeek['votes'][number]>();
  for (const row of voteRows) {
    const key = `${row.billId}|${row.date}|${row.motion}`;
    let session = sessions.get(key);
    if (!session) {
      session = { bill: row.bill, date: row.date, motion: row.motion, tally: { yes: 0, no: 0, abstain: 0, absent: 0 }, sourceUrl: row.sourceUrl };
      sessions.set(key, session);
    }
    session.tally[row.value as VoteValue] += row.n;
    if (row.sourceUrl < session.sourceUrl) session.sourceUrl = row.sourceUrl;
  }
  const voteList = [...sessions.values()].sort((a, b) => b.date.localeCompare(a.date) || a.bill.titleMn.localeCompare(b.bill.titleMn, 'mn') || a.motion.localeCompare(b.motion));

  return { from, to, stages: stageRows, votes: voteList };
}
