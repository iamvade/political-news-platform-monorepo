import { ARTICLE_STATUSES, REVISION_KINDS } from '@news/shared/schemas';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, fk, id, softDelete, timestamps } from '../columns';
import { bills } from './legislation';
import { media } from './media';
import { organizations, persons } from './people';
import { categories, tags } from './taxonomy';
import { users } from './users';

export const articleStatus = pgEnum('article_status', ARTICLE_STATUSES);
export const revisionKind = pgEnum('revision_kind', REVISION_KINDS);

/** Tiptap/ProseMirror document. Validated with `@news/shared/content` before insert. */
export type TiptapDoc = { type: 'doc'; content?: unknown[] };

export const articles = pgTable(
  'articles',
  {
    id: id(),
    title: text().notNull(),
    slug: text().notNull(),
    lede: text(),
    bodyJson: jsonb().$type<TiptapDoc>().notNull(),
    /** Sanitized HTML rendered from body_json (RSS, previews). Never edited directly. */
    bodyHtml: text().notNull(),
    status: articleStatus().notNull().default('draft'),
    publishedAt: timestamp({ withTimezone: true }),
    scheduledAt: timestamp({ withTimezone: true }),
    authorId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    coverMediaId: fk().references(() => media.id, { onDelete: 'set null' }),
    categoryId: fk().references(() => categories.id, { onDelete: 'set null' }),
    isBreaking: boolean().notNull().default(false),
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex('articles_slug_unique').on(t.slug),
    index('articles_status_published_at_idx').on(t.status, t.publishedAt),
    index('articles_scheduled_at_idx')
      .on(t.scheduledAt)
      .where(sql`${t.status} = 'scheduled'`),
    index('articles_author_id_idx').on(t.authorId),
    index('articles_cover_media_id_idx').on(t.coverMediaId),
    index('articles_category_id_idx').on(t.categoryId),
    index('articles_updated_at_idx').on(t.updatedAt),
    // Admin list `search` (ILIKE on title).
    index('articles_title_trgm_idx').using('gin', t.title.op('gin_trgm_ops')),
    check('articles_scheduled_has_time', sql`${t.status} <> 'scheduled' or ${t.scheduledAt} is not null`),
    check('articles_published_has_time', sql`${t.status} <> 'published' or ${t.publishedAt} is not null`),
  ],
);

export const articleRevisions = pgTable(
  'article_revisions',
  {
    id: id(),
    articleId: fk()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    /** What produced this revision (PRD §9.4). */
    kind: revisionKind().notNull().default('update'),
    /** Full snapshot: title, slug, lede, body_json, metadata. */
    snapshot: jsonb().$type<Record<string, unknown>>().notNull(),
    editorId: fk()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...createdAt,
  },
  (t) => [
    index('article_revisions_article_id_created_at_idx').on(t.articleId, t.createdAt),
    index('article_revisions_editor_id_idx').on(t.editorId),
  ],
);

export const articlePersons = pgTable(
  'article_persons',
  {
    articleId: fk()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    personId: fk()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    ...createdAt,
  },
  (t) => [primaryKey({ columns: [t.articleId, t.personId] }), index('article_persons_person_id_idx').on(t.personId)],
);

export const articleOrganizations = pgTable(
  'article_organizations',
  {
    articleId: fk()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    organizationId: fk()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    ...createdAt,
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.organizationId] }),
    index('article_organizations_organization_id_idx').on(t.organizationId),
  ],
);

export const articleBills = pgTable(
  'article_bills',
  {
    articleId: fk()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    billId: fk()
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    ...createdAt,
  },
  (t) => [primaryKey({ columns: [t.articleId, t.billId] }), index('article_bills_bill_id_idx').on(t.billId)],
);

export const articleTags = pgTable(
  'article_tags',
  {
    articleId: fk()
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    tagId: fk()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    ...createdAt,
  },
  (t) => [primaryKey({ columns: [t.articleId, t.tagId] }), index('article_tags_tag_id_idx').on(t.tagId)],
);
