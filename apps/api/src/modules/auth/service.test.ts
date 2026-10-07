import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from '../../db/client';
import { users } from '../../db/schema/index';
import { verifyPassword } from '../../lib/password';
import { resetDb } from '../../test/reset-db';
import { assertTestDatabase } from '../../test/test-env';
import { createAdminUser } from './service';

const url = process.env.DATABASE_URL!;
assertTestDatabase(url);
const { db, sql } = createDb(url, { max: 1 });

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await resetDb(db);
  await sql.end({ timeout: 5 });
});

describe('createAdminUser', () => {
  it('creates an admin with an argon2id hash', async () => {
    const user = await createAdminUser(db, {
      email: 'first@newsroom.example',
      displayName: 'Админ',
      password: 'a long enough password',
    });

    expect(user.role).toBe('admin');
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row?.passwordHash).not.toContain('a long enough password');
    expect(await verifyPassword(row!.passwordHash!, 'a long enough password')).toBe(true);
  });

  it('rejects a duplicate email (case-insensitive)', async () => {
    const input = { email: 'dup@newsroom.example', displayName: 'A', password: 'a long enough password' };
    await createAdminUser(db, input);

    await expect(createAdminUser(db, { ...input, email: 'DUP@newsroom.example' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'EMAIL_TAKEN',
    });
  });

  it('rejects a password shorter than 12 characters', async () => {
    await expect(
      createAdminUser(db, { email: 'short@newsroom.example', displayName: 'A', password: 'short' }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });
});
