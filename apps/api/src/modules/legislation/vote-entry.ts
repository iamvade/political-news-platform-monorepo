import { VOTE_VALUES, personDisplayName, type PaginationQuery, type VoteRoster, type VoteRosterMember, type VoteRosterQuery, type VoteSession, type VoteValue } from '@news/shared/schemas';
import { and, asc, count, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { organizations, persons, positions, votes } from '../../db/schema/index';
import { getBill } from './service';

/** Organization types whose open positions are MP seats (party-list seats sit on the parliament itself). */
const MP_SEAT_TYPES = ['parliament', 'constituency'] as const;

/** Positions held on `date` (inclusive start and end). */
const heldOn = (date: string) => and(lte(positions.startDate, date), or(isNull(positions.endDate), gte(positions.endDate, date)));

const byName = (a: { givenNameMn: string; patronymicMn: string }, b: { givenNameMn: string; patronymicMn: string }) =>
  a.givenNameMn.localeCompare(b.givenNameMn, 'mn') || a.patronymicMn.localeCompare(b.patronymicMn, 'mn');

/**
 * Everyone who should appear in the vote-entry grid for (bill, date, motion): MPs serving on that date plus
 * anyone who already has a vote recorded for it (flagged `inOffice: false` if they held no seat then).
 */
export async function voteRoster(db: Db, billId: number, query: VoteRosterQuery): Promise<VoteRoster> {
  await getBill(db, billId); // 404 for an unknown bill

  const seated = await db
    .selectDistinct({ personId: persons.id, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn })
    .from(positions)
    .innerJoin(persons, and(eq(persons.id, positions.personId), isNull(persons.deletedAt)))
    .innerJoin(organizations, and(eq(organizations.id, positions.organizationId), isNull(organizations.deletedAt)))
    .where(and(inArray(organizations.type, [...MP_SEAT_TYPES]), heldOn(query.date)));

  const recorded = await db
    .select({ id: votes.id, personId: votes.personId, value: votes.value, sourceUrl: votes.sourceUrl, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn })
    .from(votes)
    .innerJoin(persons, eq(persons.id, votes.personId))
    .where(and(eq(votes.billId, billId), eq(votes.date, query.date), eq(votes.motion, query.motion)));

  const seatedIds = new Set(seated.map((row) => row.personId));
  const voteOf = new Map(recorded.map((row) => [row.personId, row]));
  const people = [...seated.sort(byName), ...recorded.filter((row) => !seatedIds.has(row.personId)).sort(byName)];
  const ids = people.map((row) => row.personId);

  // Party on the vote date (the most recently started one wins if positions overlap).
  const parties =
    ids.length === 0
      ? []
      : await db
          .select({ personId: positions.personId, shortNameMn: organizations.shortNameMn, nameMn: organizations.nameMn })
          .from(positions)
          .innerJoin(organizations, and(eq(organizations.id, positions.organizationId), isNull(organizations.deletedAt)))
          .where(and(inArray(positions.personId, ids), eq(organizations.type, 'party'), heldOn(query.date)))
          .orderBy(asc(positions.startDate), asc(positions.id));
  const partyOf = new Map(parties.map((row) => [row.personId, row.shortNameMn ?? row.nameMn]));

  const members: VoteRosterMember[] = people.map((person) => {
    const vote = voteOf.get(person.personId);
    return {
      personId: person.personId,
      displayName: personDisplayName(person.patronymicMn, person.givenNameMn),
      partyShortName: partyOf.get(person.personId) ?? null,
      inOffice: seatedIds.has(person.personId),
      voteId: vote?.id ?? null,
      value: vote?.value ?? null,
      sourceUrl: vote?.sourceUrl ?? null,
    };
  });
  return { billId, date: query.date, motion: query.motion, members };
}

/** Roll calls recorded on a bill, newest first: one entry per (date, motion) with counts per value. */
export async function voteSessions(db: Db, billId: number, query: PaginationQuery): Promise<{ items: VoteSession[]; total: number }> {
  await getBill(db, billId);
  const rows = await db
    .select({
      date: votes.date,
      motion: votes.motion,
      value: votes.value,
      n: count(),
      sourceUrls: sql<string[]>`array_agg(distinct ${votes.sourceUrl})`,
    })
    .from(votes)
    .where(eq(votes.billId, billId))
    .groupBy(votes.date, votes.motion, votes.value);

  const sessions = new Map<string, VoteSession & { urls: Set<string> }>();
  for (const row of rows) {
    const key = `${row.date}|${row.motion}`;
    let session = sessions.get(key);
    if (!session) {
      const counts = Object.fromEntries(VOTE_VALUES.map((v) => [v, 0])) as Record<VoteValue, number>;
      session = { date: row.date, motion: row.motion, counts, total: 0, sourceUrls: [], urls: new Set() };
      sessions.set(key, session);
    }
    session.counts[row.value] += row.n;
    session.total += row.n;
    for (const url of row.sourceUrls) session.urls.add(url);
  }
  const all = [...sessions.values()]
    .map(({ urls, ...session }) => ({ ...session, sourceUrls: [...urls].sort() }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.motion.localeCompare(b.motion));
  const start = (query.page - 1) * query.pageSize;
  return { items: all.slice(start, start + query.pageSize), total: all.length };
}
