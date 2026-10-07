import type { HomepageZones } from '@news/shared/schemas';
import { index, jsonb, pgTable } from 'drizzle-orm/pg-core';
import { fk, id, timestamps } from '../columns';
import { users } from './users';

/**
 * Append-only homepage layout versions. The row with the highest id is live; saving inserts a new row,
 * so older versions stay available for revert. `zones` is validated with `homepageZonesSchema` before insert.
 */
export const homepageLayouts = pgTable(
  'homepage_layouts',
  {
    id: id(),
    zones: jsonb().$type<HomepageZones>().notNull(),
    createdBy: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [index('homepage_layouts_created_by_idx').on(t.createdBy)],
);
