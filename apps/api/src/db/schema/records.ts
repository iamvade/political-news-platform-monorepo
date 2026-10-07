import { PROMISE_STATUSES, type PromiseEvidence } from '@news/shared/schemas';
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { fk, id, sourceUrl, sourceUrlCheck, timestamps } from '../columns';
import { articles } from './articles';
import { organizations, persons } from './people';

export const promiseStatus = pgEnum('promise_status', PROMISE_STATUSES);

/** MNT amounts. Returned as strings by the driver; never convert to float for storage. */
const mnt = () => numeric({ precision: 18, scale: 2 });

export const statements = pgTable(
  'statements',
  {
    id: id(),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    quoteMn: text().notNull(),
    contextMn: text(),
    saidOn: date().notNull(),
    articleId: fk().references(() => articles.id, { onDelete: 'set null' }),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    index('statements_person_id_said_on_idx').on(t.personId, t.saidOn),
    index('statements_article_id_idx').on(t.articleId),
    sourceUrlCheck('statements', t.sourceUrl),
  ],
);

/** A promise made by a person or by an organization (party, government) — exactly one of the two. */
export const promises = pgTable(
  'promises',
  {
    id: id(),
    personId: fk().references(() => persons.id, { onDelete: 'restrict' }),
    organizationId: fk().references(() => organizations.id, { onDelete: 'restrict' }),
    textMn: text().notNull(),
    madeOn: date().notNull(),
    status: promiseStatus().notNull().default('not_rated'),
    evidence: jsonb().$type<PromiseEvidence[]>().notNull().default([]),
    lastReviewedAt: timestamp({ withTimezone: true }),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    index('promises_person_id_idx').on(t.personId),
    index('promises_organization_id_idx').on(t.organizationId),
    index('promises_status_idx').on(t.status),
    check('promises_one_subject', sql`num_nonnulls(${t.personId}, ${t.organizationId}) = 1`),
    sourceUrlCheck('promises', t.sourceUrl),
  ],
);

/** Public asset and income declaration, one per person per year. */
export const declarations = pgTable(
  'declarations',
  {
    id: id(),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    year: integer().notNull(),
    filedOn: date(),
    income: mnt(),
    assets: mnt(),
    liabilities: mnt(),
    /** Itemised figures (real estate, vehicles, ...). Shape defined when the declaration form is built. */
    details: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('declarations_person_id_year_unique').on(t.personId, t.year),
    sourceUrlCheck('declarations', t.sourceUrl),
  ],
);
