import { ErrorCode, type AuthUser, type CreateTagBody, type TaxonomyItem } from '@news/shared/schemas';
import { slugify } from '@news/shared/translit';
import { sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { tags } from '../../db/schema/index';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { uniqueSlug } from '../../lib/slugs';

const TAG_SLUGS = { table: tags, id: tags.id, slug: tags.slug };

type TagRow = typeof tags.$inferSelect;

const toTaxonomyItem = (row: TagRow): TaxonomyItem => ({ id: row.id, slug: row.slug, nameMn: row.nameMn, nameEn: row.nameEn });

/** Inline tag creation from the article editor. Same Mongolian name (case-insensitive) → 409 DUPLICATE. */
export async function createTag(db: Db, user: AuthUser, body: CreateTagBody): Promise<TaxonomyItem> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(sql`lower(${tags.nameMn}) = lower(${body.nameMn})`)
      .limit(1);
    if (existing) throw new AppError(409, ErrorCode.DUPLICATE, `A tag with this name already exists (id ${existing.id})`);

    const nameEn = body.nameEn || null;
    const slug = await uniqueSlug(tx, TAG_SLUGS, slugify(nameEn ?? body.nameMn, 'tag'));
    const [row] = await tx.insert(tags).values({ slug, nameMn: body.nameMn, nameEn }).returning();
    const dto = toTaxonomyItem(row!);
    await audit(tx, { actorId: user.id, action: 'create', entityType: 'tag', entityId: dto.id, diff: { after: dto } });
    return dto;
  });
}
