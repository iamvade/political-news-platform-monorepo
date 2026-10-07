import { CORRECTION_ENTITY_TYPES } from '@news/shared/schemas';
import { bigint, date, index, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { fk, id, timestamps } from '../columns';
import { users } from './users';

export const correctionEntityType = pgEnum('correction_entity_type', CORRECTION_ENTITY_TYPES);

/** Public corrections log. Polymorphic target (entity_type + entity_id), so no FK on entity_id. */
export const corrections = pgTable(
  'corrections',
  {
    id: id(),
    entityType: correctionEntityType().notNull(),
    entityId: bigint({ mode: 'number' }).notNull(),
    date: date().notNull(),
    description: text().notNull(),
    reason: text().notNull(),
    createdBy: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [
    index('corrections_entity_idx').on(t.entityType, t.entityId),
    index('corrections_date_idx').on(t.date),
    index('corrections_created_by_idx').on(t.createdBy),
  ],
);
