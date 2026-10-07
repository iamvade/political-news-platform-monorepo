import { ErrorCode, personDisplayName } from '@news/shared/schemas';
import { and, asc, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { Db } from '../../db/client';
import {
  articles,
  bills,
  declarations,
  media,
  organizations,
  persons,
  positions,
  promises,
  statements,
  votes,
} from '../../db/schema/index';
import { isoOrNull } from '../../lib/crud';
import { AppError } from '../../lib/errors';
import { toPublicMedia } from '../../lib/media';

type PageQuery = { page: number; pageSize: number };

const orgRefColumns = {
  slug: organizations.slug,
  type: organizations.type,
  nameMn: organizations.nameMn,
  nameEn: organizations.nameEn,
  shortNameMn: organizations.shortNameMn,
  color: organizations.color,
};

function personRef(row: { slug: string; givenNameMn: string; patronymicMn: string }) {
  return {
    slug: row.slug,
    displayName: personDisplayName(row.patronymicMn, row.givenNameMn),
    givenNameMn: row.givenNameMn,
    patronymicMn: row.patronymicMn,
  };
}

const offset = (q: PageQuery) => (q.page - 1) * q.pageSize;

/** Live person id by slug, or 404. Used by the profile and every sub-resource. */
export async function personIdBySlug(db: Db, slug: string): Promise<number> {
  const [row] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(and(eq(persons.slug, slug), isNull(persons.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'Person not found');
  return row.id;
}

/** Current (open) positions in live organizations, with the organization. */
function positionsQuery(db: Db, where: SQL) {
  return db
    .select({ position: positions, organization: orgRefColumns })
    .from(positions)
    .innerJoin(organizations, and(eq(organizations.id, positions.organizationId), isNull(organizations.deletedAt)))
    .where(where);
}

function toPublicPosition(row: Awaited<ReturnType<typeof positionsQuery>>[number]) {
  return {
    titleMn: row.position.titleMn,
    titleEn: row.position.titleEn,
    startDate: row.position.startDate,
    endDate: row.position.endDate,
    sourceUrl: row.position.sourceUrl,
    organization: row.organization,
  };
}

export async function getPersonProfile(db: Db, mediaBase: string | undefined, slug: string) {
  const [row] = await db
    .select({
      person: persons,
      photo: { status: media.status, alt: media.alt, credit: media.credit, width: media.width, height: media.height, variants: media.variants },
    })
    .from(persons)
    .leftJoin(media, and(eq(media.id, persons.photoMediaId), isNull(media.deletedAt)))
    .where(and(eq(persons.slug, slug), isNull(persons.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'Person not found');
  const { person } = row;

  const current = (
    await positionsQuery(db, and(eq(positions.personId, person.id), isNull(positions.endDate))!).orderBy(
      desc(positions.startDate),
      asc(positions.id),
    )
  ).map(toPublicPosition);

  return {
    ...personRef(person),
    givenNameEn: person.givenNameEn,
    patronymicEn: person.patronymicEn,
    birthDate: person.birthDate,
    bioMn: person.bioMn,
    photo: toPublicMedia(row.photo, mediaBase),
    currentPositions: current,
    party: current.find((p) => p.organization.type === 'party')?.organization ?? null,
    constituency: current.find((p) => p.organization.type === 'constituency')?.organization ?? null,
  };
}

export async function listPersonPositions(db: Db, personId: number, q: PageQuery) {
  const where = eq(positions.personId, personId);
  const [total] = await db
    .select({ n: count() })
    .from(positions)
    .innerJoin(organizations, and(eq(organizations.id, positions.organizationId), isNull(organizations.deletedAt)))
    .where(where);
  const rows = await positionsQuery(db, where)
    .orderBy(desc(positions.startDate), desc(positions.id))
    .limit(q.pageSize)
    .offset(offset(q));
  return { items: rows.map(toPublicPosition), total: total?.n ?? 0 };
}

export async function listPersonVotes(db: Db, personId: number, q: PageQuery) {
  const where = eq(votes.personId, personId);
  const [total] = await db.select({ n: count() }).from(votes).where(where);
  const rows = await db
    .select({ vote: votes, bill: { slug: bills.slug, titleMn: bills.titleMn } })
    .from(votes)
    .innerJoin(bills, eq(bills.id, votes.billId))
    .where(where)
    .orderBy(desc(votes.date), asc(votes.motion), desc(votes.id))
    .limit(q.pageSize)
    .offset(offset(q));
  return {
    items: rows.map((r) => ({
      bill: r.bill,
      value: r.vote.value,
      date: r.vote.date,
      motion: r.vote.motion,
      sourceUrl: r.vote.sourceUrl,
    })),
    total: total?.n ?? 0,
  };
}

export async function listPersonStatements(db: Db, personId: number, q: PageQuery) {
  const where = eq(statements.personId, personId);
  const [total] = await db.select({ n: count() }).from(statements).where(where);
  // Link the article only if it is currently published.
  const rows = await db
    .select({ statement: statements, article: { slug: articles.slug, title: articles.title } })
    .from(statements)
    .leftJoin(
      articles,
      and(eq(articles.id, statements.articleId), eq(articles.status, 'published'), isNull(articles.deletedAt)),
    )
    .where(where)
    .orderBy(desc(statements.saidOn), desc(statements.id))
    .limit(q.pageSize)
    .offset(offset(q));
  return {
    items: rows.map((r) => ({
      quoteMn: r.statement.quoteMn,
      contextMn: r.statement.contextMn,
      saidOn: r.statement.saidOn,
      sourceUrl: r.statement.sourceUrl,
      article: r.article,
    })),
    total: total?.n ?? 0,
  };
}

export async function listPersonPromises(db: Db, personId: number, q: PageQuery) {
  const where = eq(promises.personId, personId);
  const [total] = await db.select({ n: count() }).from(promises).where(where);
  const rows = await db
    .select()
    .from(promises)
    .where(where)
    .orderBy(desc(promises.madeOn), desc(promises.id))
    .limit(q.pageSize)
    .offset(offset(q));
  return {
    items: rows.map((r) => ({
      textMn: r.textMn,
      madeOn: r.madeOn,
      status: r.status,
      evidence: r.evidence,
      lastReviewedAt: isoOrNull(r.lastReviewedAt),
      sourceUrl: r.sourceUrl,
    })),
    total: total?.n ?? 0,
  };
}

export async function listPersonDeclarations(db: Db, personId: number, q: PageQuery) {
  const where = eq(declarations.personId, personId);
  const [total] = await db.select({ n: count() }).from(declarations).where(where);
  const rows = await db
    .select()
    .from(declarations)
    .where(where)
    .orderBy(desc(declarations.year))
    .limit(q.pageSize)
    .offset(offset(q));
  return {
    items: rows.map((r) => ({
      year: r.year,
      filedOn: r.filedOn,
      income: r.income,
      assets: r.assets,
      liabilities: r.liabilities,
      details: r.details,
      sourceUrl: r.sourceUrl,
    })),
    total: total?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------------------------------------------

const parentOrg = alias(organizations, 'parent_org');

export async function getOrganizationDetail(db: Db, mediaBase: string | undefined, slug: string) {
  const [row] = await db
    .select({
      org: organizations,
      parent: {
        slug: parentOrg.slug,
        type: parentOrg.type,
        nameMn: parentOrg.nameMn,
        nameEn: parentOrg.nameEn,
        shortNameMn: parentOrg.shortNameMn,
        color: parentOrg.color,
      },
      logo: { status: media.status, alt: media.alt, credit: media.credit, width: media.width, height: media.height, variants: media.variants },
    })
    .from(organizations)
    .leftJoin(parentOrg, and(eq(parentOrg.id, organizations.parentId), isNull(parentOrg.deletedAt)))
    .leftJoin(media, and(eq(media.id, organizations.logoMediaId), isNull(media.deletedAt)))
    .where(and(eq(organizations.slug, slug), isNull(organizations.deletedAt)))
    .limit(1);
  if (!row) throw new AppError(404, ErrorCode.NOT_FOUND, 'Organization not found');
  const { org } = row;

  const members = await db
    .select({
      person: { slug: persons.slug, givenNameMn: persons.givenNameMn, patronymicMn: persons.patronymicMn },
      titleMn: positions.titleMn,
      titleEn: positions.titleEn,
      startDate: positions.startDate,
    })
    .from(positions)
    .innerJoin(persons, and(eq(persons.id, positions.personId), isNull(persons.deletedAt)))
    .where(and(eq(positions.organizationId, org.id), isNull(positions.endDate)))
    .orderBy(asc(positions.titleMn), asc(persons.givenNameMn), asc(persons.id));

  return {
    slug: org.slug,
    type: org.type,
    nameMn: org.nameMn,
    nameEn: org.nameEn,
    shortNameMn: org.shortNameMn,
    color: org.color,
    parent: row.parent,
    logo: toPublicMedia(row.logo, mediaBase),
    members: members.map((m) => ({ ...m, person: personRef(m.person) })),
  };
}

