import { errorResponseSchema, taxonomyItemResponseSchema, type UserRole } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { auditLog, tags } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { resetDb } from '../../test/reset-db';
import { signIn, type TestActor } from '../../test/sessions';

let app: App;
let editor: TestActor;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  editor = await signIn(app, 'editor');
});

function createTag(actor: TestActor | null, payload: unknown) {
  return app.inject({
    method: 'POST',
    url: '/v1/admin/tags',
    payload: payload as Record<string, unknown>,
    cookies: actor?.cookies,
    headers: actor?.headers,
  });
}

const errorCode = (res: { json: () => unknown }) => errorResponseSchema.parse(res.json()).error.code;

describe('POST /v1/admin/tags', () => {
  it('creates a tag with a Latin slug and writes the audit log', async () => {
    const res = await createTag(editor, { nameMn: 'Өрийн тааз' });

    expect(res.statusCode).toBe(201);
    const tag = taxonomyItemResponseSchema.parse(res.json()).data;
    expect(tag).toMatchObject({ nameMn: 'Өрийн тааз', nameEn: null });
    expect(tag.slug).toMatch(/^[a-z0-9-]+$/);
    const [entry] = await app.db.select().from(auditLog).where(eq(auditLog.entityId, tag.id));
    expect(entry).toMatchObject({ action: 'create', entityType: 'tag', actorId: editor.user.id });
  });

  it('prefers the English name for the slug and keeps slugs unique', async () => {
    await app.db.insert(tags).values({ slug: 'budget', nameMn: 'Өөр шошго' });

    const res = await createTag(editor, { nameMn: 'Төсөв', nameEn: 'Budget' });

    expect(taxonomyItemResponseSchema.parse(res.json()).data.slug).toBe('budget-2');
  });

  it('refuses a duplicate Mongolian name (case-insensitive)', async () => {
    await createTag(editor, { nameMn: 'Сонгууль' });

    const res = await createTag(editor, { nameMn: 'сонгууль' });

    expect(res.statusCode).toBe(409);
    expect(errorCode(res)).toBe('DUPLICATE');
  });

  it.each([
    ['reporter', 403],
    ['data_editor', 403],
    ['admin', 201],
  ] satisfies [UserRole, number][])('%s → %i', async (role, status) => {
    const res = await createTag(await signIn(app, role), { nameMn: `Шошго ${role}` });
    expect(res.statusCode).toBe(status);
  });

  it('requires a session and validates the body', async () => {
    expect((await createTag(null, { nameMn: 'Шошго' })).statusCode).toBe(401);
    const invalid = await createTag(editor, { nameMn: '' });
    expect(invalid.statusCode).toBe(400);
    expect(errorCode(invalid)).toBe('VALIDATION_ERROR');
  });
});
