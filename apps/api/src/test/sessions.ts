import { randomBytes } from 'node:crypto';
import type { UserRole } from '@news/shared/schemas';
import type { App } from '../app';
import { sessions } from '../db/schema/index';
import { csrfTokenFor, hashToken, SESSION_ABSOLUTE_TTL_MS, SESSION_COOKIE } from '../modules/auth/service';
import { createTestUser } from './factories';

export interface TestActor {
  user: Awaited<ReturnType<typeof createTestUser>>;
  cookies: Record<string, string>;
  headers: Record<string, string>;
}

/**
 * Creates a user with a live session without going through /login (no argon2, no login rate limit).
 * Login itself is covered by the auth tests.
 */
export async function signIn(app: App, role: UserRole): Promise<TestActor> {
  const user = await createTestUser(app.db, { role, password: null });
  const token = randomBytes(32).toString('base64url');
  const sessionId = hashToken(token);
  await app.db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(Date.now() + SESSION_ABSOLUTE_TTL_MS),
  });
  return {
    user,
    cookies: { [SESSION_COOKIE]: token },
    headers: { 'x-csrf-token': csrfTokenFor(app.env.AUTH_SECRET, sessionId) },
  };
}
