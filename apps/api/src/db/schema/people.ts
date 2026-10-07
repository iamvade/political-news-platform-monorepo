import { ORGANIZATION_TYPES } from '@news/shared/schemas';
import { sql } from 'drizzle-orm';
import { check, date, index, pgEnum, pgTable, text, uniqueIndex, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { fk, id, softDelete, sourceUrl, sourceUrlCheck, timestamps } from '../columns';
import { media } from './media';

export const organizationType = pgEnum('organization_type', ORGANIZATION_TYPES);

export const persons = pgTable(
  'persons',
  {
    id: id(),
    /** Latin, e.g. `b-bat-erdene`. */
    slug: text().notNull(),
    /** Нэр */
    givenNameMn: text().notNull(),
    /** Овог (patronymic); displayed as an initial: "Б.Бат-Эрдэнэ". */
    patronymicMn: text().notNull(),
    givenNameEn: text(),
    patronymicEn: text(),
    birthDate: date(),
    gender: text(),
    photoMediaId: fk().references(() => media.id, { onDelete: 'set null' }),
    bioMn: text(),
    ...timestamps,
    ...softDelete,
  },
  (t) => [uniqueIndex('persons_slug_unique').on(t.slug), index('persons_photo_media_id_idx').on(t.photoMediaId)],
);

export const organizations = pgTable(
  'organizations',
  {
    id: id(),
    type: organizationType().notNull(),
    slug: text().notNull(),
    nameMn: text().notNull(),
    nameEn: text(),
    shortNameMn: text(),
    /** committee → parliament, constituency → parliament, agency → ministry. */
    parentId: fk().references((): AnyPgColumn => organizations.id, { onDelete: 'set null' }),
    /** Party colour, `#RRGGBB`. */
    color: text(),
    logoMediaId: fk().references(() => media.id, { onDelete: 'set null' }),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('organizations_slug_unique').on(t.slug),
    index('organizations_type_idx').on(t.type),
    index('organizations_parent_id_idx').on(t.parentId),
    index('organizations_logo_media_id_idx').on(t.logoMediaId),
  ],
);

/** Any role a person holds in an organization: party membership, MP seat, committee seat, minister, agency head. */
export const positions = pgTable(
  'positions',
  {
    id: id(),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'restrict' }),
    organizationId: fk()
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    titleMn: text().notNull(),
    titleEn: text(),
    startDate: date().notNull(),
    /** Null = current. */
    endDate: date(),
    ...sourceUrl,
    ...timestamps,
  },
  (t) => [
    index('positions_person_id_idx').on(t.personId),
    index('positions_organization_id_end_date_idx').on(t.organizationId, t.endDate),
    check('positions_dates_ordered', sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    sourceUrlCheck('positions', t.sourceUrl),
  ],
);
