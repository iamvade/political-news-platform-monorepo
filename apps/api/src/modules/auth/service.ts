import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ErrorCode, passwordSchema, type AuthUser, type LoginBody } from '@news/shared/schemas';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../../db/client';
import { sessions, users } from '../../db/schema/index';
import { AppError } from '../../lib/errors';
import { getDummyHash, hashPassword, verifyPassword } from '../../lib/password';

export const SESSION_COOKIE = 'sid';
export const SESSION_ABSOLUTE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = 12 * 60 * 60 * 1000;
/** Only write `last_seen_at` when it is older than this, to avoid a DB write on every request. */
const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

type UserRow = typeof users.$inferSelect;

export function toAuthUser(user: UserRow): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

/** Session ids stored in the DB are sha256(token); the raw token only lives in the cookie. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function csrfTokenFor(secret: string, sessionId: string): string {
  return createHmac('sha256', secret).update(sessionId).digest('base64url');
}

export function isValidCsrfToken(secret: string, sessionId: string, provided: string | undefined): boolean {
  if (!provided) return false;
  const expected = Buffer.from(csrfTokenFor(secret, sessionId));
  const actual = Buffer.from(provided);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function findUserByEmail(db: Db, email: string) {
  return db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email.toLowerCase()))
    .limit(1)
    .then((rows) => rows[0]);
}

export interface LoginResult {
  token: string;
  sessionId: string;
  user: AuthUser;
}

/** Verifies credentials and creates a new session. Returns null for any failure (no reason is exposed). */
export async function login(
  db: Db,
  credentials: LoginBody,
  meta: { ip: string | null; userAgent: string | null },
): Promise<LoginResult | null> {
  const user = await findUserByEmail(db, credentials.email);
  const passwordOk = await verifyPassword(user?.passwordHash ?? (await getDummyHash()), credentials.password);
  if (!user || !user.passwordHash || !user.isActive || !passwordOk) return null;

  const token = randomBytes(32).toString('base64url');
  const sessionId = hashToken(token);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.insert(sessions).values({
      id: sessionId,
      userId: user.id,
      expiresAt: new Date(now.getTime() + SESSION_ABSOLUTE_TTL_MS),
      lastSeenAt: now,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await tx.update(users).set({ lastLoginAt: now }).where(eq(users.id, user.id));
  });

  return { token, sessionId, user: toAuthUser(user) };
}

export type SessionLookup =
  | { status: 'ok'; sessionId: string; user: AuthUser }
  | { status: 'missing' | 'expired' | 'inactive' };

/** Resolves a cookie token to a user, enforcing absolute and idle expiry. Deletes dead sessions. */
export async function loadSession(db: Db, token: string, now = new Date()): Promise<SessionLookup> {
  const sessionId = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!row) return { status: 'missing' };

  const idleExpired = now.getTime() - row.session.lastSeenAt.getTime() >= SESSION_IDLE_TTL_MS;
  if (row.session.expiresAt <= now || idleExpired) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return { status: 'expired' };
  }

  if (!row.user.isActive) {
    await db.delete(sessions).where(eq(sessions.userId, row.user.id));
    return { status: 'inactive' };
  }

  if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
    await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, sessionId));
  }

  return { status: 'ok', sessionId, user: toAuthUser(row.user) };
}

export async function deleteSession(db: Db, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Used by the `admin:create` CLI. */
export async function createAdminUser(
  db: Db,
  input: { email: string; displayName: string; password: string },
): Promise<AuthUser> {
  if (!passwordSchema.safeParse(input.password).success) {
    throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Password must be 12–256 characters');
  }
  if (await findUserByEmail(db, input.email)) {
    throw new AppError(409, 'EMAIL_TAKEN', `A user with email ${input.email} already exists`);
  }

  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      displayName: input.displayName,
      role: 'admin',
      passwordHash: await hashPassword(input.password),
    })
    .returning();
  if (!user) throw new Error('User insert failed');
  return toAuthUser(user);
}
