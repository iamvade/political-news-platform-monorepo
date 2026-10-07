import { index, integer, pgTable, text, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { fk, id, timestamps } from '../columns';

export const categories = pgTable(
  'categories',
  {
    id: id(),
    slug: text().notNull(),
    nameMn: text().notNull(),
    nameEn: text(),
    parentId: fk().references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
    sortOrder: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex('categories_slug_unique').on(t.slug), index('categories_parent_id_idx').on(t.parentId)],
);

export const tags = pgTable(
  'tags',
  {
    id: id(),
    slug: text().notNull(),
    nameMn: text().notNull(),
    nameEn: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('tags_slug_unique').on(t.slug)],
);
