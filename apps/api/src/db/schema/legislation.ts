import { BILL_INITIATORS, BILL_STAGES, BILL_STATUSES, SPONSOR_ROLES, VOTE_VALUES } from '@news/shared/schemas';
import { date, index, pgEnum, pgTable, primaryKey, text, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, fk, id, sourceUrl, sourceUrlCheck, timestamps } from '../columns';
import { persons } from './people';

export const billInitiator = pgEnum('bill_initiator', BILL_INITIATORS);
export const billStatus = pgEnum('bill_status', BILL_STATUSES);
export const billStage = pgEnum('bill_stage', BILL_STAGES);
export const sponsorRole = pgEnum('sponsor_role', SPONSOR_ROLES);
export const voteValue = pgEnum('vote_value', VOTE_VALUES);

export const bills = pgTable(
  'bills',
  {
    id: id(),
    slug: text().notNull(),
    titleMn: text().notNull(),
    titleEn: text(),
    registrationNumber: text(),
    initiatorType: billInitiator().notNull(),
    status: billStatus().notNull(),
    submittedOn: date(),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('bills_slug_unique').on(t.slug),
    index('bills_status_idx').on(t.status),
    sourceUrlCheck('bills', t.sourceUrl),
  ],
);

export const billSponsors = pgTable(
  'bill_sponsors',
  {
    billId: fk()
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    role: sponsorRole().notNull(),
    ...createdAt,
  },
  (t) => [primaryKey({ columns: [t.billId, t.personId] }), index('bill_sponsors_person_id_idx').on(t.personId)],
);

export const billStages = pgTable(
  'bill_stages',
  {
    id: id(),
    billId: fk()
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    stage: billStage().notNull(),
    date: date().notNull(),
    noteMn: text(),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [index('bill_stages_bill_id_date_idx').on(t.billId, t.date), sourceUrlCheck('bill_stages', t.sourceUrl)],
);

export const votes = pgTable(
  'votes',
  {
    id: id(),
    billId: fk()
      .notNull()
      .references(() => bills.id, { onDelete: 'restrict' }),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    value: voteValue().notNull(),
    date: date().notNull(),
    /** Which vote on that day, e.g. `consideration`, `final_vote`, `amendment_3`. */
    motion: text().notNull(),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    uniqueIndex('votes_bill_person_date_motion_unique').on(t.billId, t.personId, t.date, t.motion),
    index('votes_person_id_idx').on(t.personId),
    sourceUrlCheck('votes', t.sourceUrl),
  ],
);
