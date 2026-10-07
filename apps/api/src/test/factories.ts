import type { UserRole } from '@news/shared/schemas';
import type { Db } from '../db/client';
import { users } from '../db/schema/index';
import { hashPassword } from '../lib/password';

export const TEST_PASSWORD = 'correct horse battery staple';

let sequence = 0;

/** Inserts a user. `password: null` creates an invite-pending user with no password. */
export async function createTestUser(
  db: Db,
  overrides: { role?: UserRole; email?: string; password?: string | null; isActive?: boolean } = {},
) {
  sequence += 1;
  const password = overrides.password === undefined ? TEST_PASSWORD : overrides.password;
  const [user] = await db
    .insert(users)
    .values({
      email: overrides.email ?? `user${sequence}@newsroom.example`,
      displayName: `Test user ${sequence}`,
      role: overrides.role ?? 'reporter',
      isActive: overrides.isActive ?? true,
      passwordHash: password === null ? null : await hashPassword(password),
    })
    .returning();
  if (!user) throw new Error('createTestUser failed');
  return user;
}
