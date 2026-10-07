import { sql } from 'drizzle-orm';
import { bigint, check, text, timestamp, type AnyPgColumn } from 'drizzle-orm/pg-core';

/** `bigint generated always as identity` primary key. */
export const id = () => bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();

/** Foreign key column type matching `id()`. Chain `.references(...)` with an explicit `onDelete`. */
export const fk = () => bigint({ mode: 'number' });

/** `created_at` / `updated_at` (timestamptz). Spread into every table. */
export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** `created_at` only, for immutable rows (join tables, revisions). */
export const createdAt = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
};

/** `deleted_at` (timestamptz, nullable). Spread into soft-deletable tables only. */
export const softDelete = {
  deletedAt: timestamp({ withTimezone: true }),
};

/** Required provenance for factual tables. Pair with `sourceUrlCheck()`. */
export const sourceUrl = {
  sourceUrl: text().notNull(),
};

export const sourceUrlCheck = (table: string, column: AnyPgColumn) =>
  check(`${table}_source_url_http`, sql`${column} ~ '^https?://'`);
