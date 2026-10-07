import { AUDIT_ACTIONS } from '@news/shared/schemas';
import { bigint, index, jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';
import { createdAt, fk, id } from '../columns';
import { users } from './users';

export const auditAction = pgEnum('audit_action', AUDIT_ACTIONS);

/** Append-only log of admin mutations (who, what, when, diff). Written in the same transaction as the change. */
export const auditLog = pgTable(
  'audit_log',
  {
    id: id(),
    actorId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    action: auditAction().notNull(),
    /** Table-level name, e.g. `person`, `vote`. */
    entityType: text().notNull(),
    /** Null for bulk imports (the touched ids are in `diff`). */
    entityId: bigint({ mode: 'number' }),
    diff: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    ...createdAt,
  },
  (t) => [
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
    index('audit_log_actor_id_idx').on(t.actorId),
    index('audit_log_created_at_idx').on(t.createdAt),
  ],
);
