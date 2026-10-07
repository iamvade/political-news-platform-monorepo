import { authSessionResponseSchema, errorResponseSchema } from '@news/shared/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { App } from '../../app';
import { sessions, users } from '../../db/schema/index';
import { buildTestApp } from '../../test/app';
import { createTestUser, TEST_PASSWORD } from '../../test/factories';
import { resetDb } from '../../test/reset-db';
import { hashToken, SESSION_COOKIE, SESSION_IDLE_TTL_MS } from './service';

const LOGIN = '/v1/admin/auth/login';
const ME = '/v1/admin/auth/me';
const LOGOUT = '/v1/admin/auth/logout';

let app: App;

beforeAll(async () => {
  app = await buildTestApp();
  // Ad-hoc route to exercise requireRole; real admin modules use the same preHandler.
  app.get('/__test/editor-only', { preHandler: app.requireRole('editor') }, async (request) => ({
    data: { role: request.user?.role },
  }));
  await app.ready();
});

afterAll(async () => {
  await resetDb(app.db);
  await app.close();
});

beforeEach(async () => {
  await resetDb(app.db);
  await app.redis.flushdb();
});

function errorCode(res: { json: () => unknown }) {
  return errorResponseSchema.parse(res.json()).error.code;
}

async function login(email: string, password = TEST_PASSWORD) {
  const res = await app.inject({ method: 'POST', url: LOGIN, payload: { email, password } });
  const token = res.cookies.find((c) => c.name === SESSION_COOKIE)?.value;
  return { res, token };
}

async function loginOk(email: string) {
  const { res, token } = await login(email);
  expect(res.statusCode).toBe(200);
  if (!token) throw new Error('no session cookie');
  return { token, csrfToken: authSessionResponseSchema.parse(res.json()).data.csrfToken };
}

describe('POST /v1/admin/auth/login', () => {
  it('sets a hardened session cookie and returns the user without the password hash', async () => {
    const user = await createTestUser(app.db, { role: 'editor', email: 'Editor@Newsroom.example' });

    const { res, token } = await login('editor@newsroom.example'); // email match is case-insensitive

    expect(res.statusCode).toBe(200);
    const cookie = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Strict', path: '/' });
    expect(cookie?.maxAge).toBe(7 * 24 * 60 * 60);

    const body = res.json();
    expect(authSessionResponseSchema.parse(body).data.user).toEqual({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: 'editor',
    });
    expect(JSON.stringify(body)).not.toContain('argon2');

    // Only the hash of the token is stored.
    const rows = await app.db.select().from(sessions);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).not.toBe(token);
    expect(rows[0]?.id).toBe(hashToken(token!));

    const [updated] = await app.db.select().from(users).where(eq(users.id, user.id));
    expect(updated?.lastLoginAt).toBeInstanceOf(Date);
  });

  it.each<[string, { email?: string; password?: string }]>([
    ['wrong password', { password: 'wrong password here' }],
    ['unknown email', { email: 'nobody@newsroom.example' }],
  ])('rejects %s with INVALID_CREDENTIALS', async (_label, attempt) => {
    await createTestUser(app.db, { email: 'known@newsroom.example' });

    const { res, token } = await login(attempt.email ?? 'known@newsroom.example', attempt.password);

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('INVALID_CREDENTIALS');
    expect(token).toBeUndefined();
  });

  it('rejects invite-pending and inactive users with the same error', async () => {
    await createTestUser(app.db, { email: 'pending@newsroom.example', password: null });
    await createTestUser(app.db, { email: 'inactive@newsroom.example', isActive: false });

    for (const email of ['pending@newsroom.example', 'inactive@newsroom.example']) {
      const { res } = await login(email);
      expect(res.statusCode).toBe(401);
      expect(errorCode(res)).toBe('INVALID_CREDENTIALS');
    }
  });

  it('validates the body', async () => {
    const res = await app.inject({ method: 'POST', url: LOGIN, payload: { password: 'x' } });

    expect(res.statusCode).toBe(400);
    expect(errorCode(res)).toBe('VALIDATION_ERROR');
  });

  it('rejects requests from a foreign Origin', async () => {
    await createTestUser(app.db, { email: 'origin@newsroom.example' });

    const res = await app.inject({
      method: 'POST',
      url: LOGIN,
      headers: { origin: 'https://evil.example' },
      payload: { email: 'origin@newsroom.example', password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('CSRF_INVALID');
  });

  it('allows same-origin requests (Swagger UI served by the API)', async () => {
    await createTestUser(app.db, { email: 'swagger@newsroom.example' });

    const res = await app.inject({
      method: 'POST',
      url: LOGIN,
      headers: { host: 'localhost:4000', origin: 'http://localhost:4000' },
      payload: { email: 'swagger@newsroom.example', password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(200);
  });

  it('treats the same host on another port as a foreign origin', async () => {
    const res = await app.inject({
      method: 'POST',
      url: LOGIN,
      headers: { host: 'localhost:4000', origin: 'http://localhost:9999' },
      payload: { email: 'swagger@newsroom.example', password: TEST_PASSWORD },
    });

    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('CSRF_INVALID');
  });

  it('rate limits repeated attempts for the same email', async () => {
    await createTestUser(app.db, { email: 'target@newsroom.example' });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const { res } = await login('target@newsroom.example', 'wrong password here');
      statuses.push(res.statusCode);
    }

    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });
});

describe('GET /v1/admin/auth/me', () => {
  it('requires a session', async () => {
    const res = await app.inject({ method: 'GET', url: ME });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('UNAUTHORIZED');
  });

  it('rejects an unknown token', async () => {
    const res = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: 'forged-token' } });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('UNAUTHORIZED');
  });

  it('returns the user and the same CSRF token as login', async () => {
    await createTestUser(app.db, { email: 'me@newsroom.example' });
    const { token, csrfToken } = await loginOk('me@newsroom.example');

    const res = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: token } });

    expect(res.statusCode).toBe(200);
    const body = authSessionResponseSchema.parse(res.json());
    expect(body.data.user.email).toBe('me@newsroom.example');
    expect(body.data.csrfToken).toBe(csrfToken);
  });
});

describe('POST /v1/admin/auth/logout', () => {
  it('requires the CSRF token', async () => {
    await createTestUser(app.db, { email: 'logout@newsroom.example' });
    const { token } = await loginOk('logout@newsroom.example');

    const missing = await app.inject({ method: 'POST', url: LOGOUT, cookies: { [SESSION_COOKIE]: token } });
    const wrong = await app.inject({
      method: 'POST',
      url: LOGOUT,
      cookies: { [SESSION_COOKIE]: token },
      headers: { 'x-csrf-token': 'not-the-token' },
    });

    expect(missing.statusCode).toBe(403);
    expect(errorCode(missing)).toBe('CSRF_INVALID');
    expect(wrong.statusCode).toBe(403);
    expect(await app.db.select().from(sessions)).toHaveLength(1);
  });

  it('deletes the session and clears the cookie', async () => {
    await createTestUser(app.db, { email: 'logout2@newsroom.example' });
    const { token, csrfToken } = await loginOk('logout2@newsroom.example');

    const res = await app.inject({
      method: 'POST',
      url: LOGOUT,
      cookies: { [SESSION_COOKIE]: token },
      headers: { 'x-csrf-token': csrfToken },
    });

    expect(res.statusCode).toBe(204);
    const cleared = res.cookies.find((c) => c.name === SESSION_COOKIE);
    expect(cleared?.value).toBe('');
    expect(await app.db.select().from(sessions)).toHaveLength(0);

    const after = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: token } });
    expect(after.statusCode).toBe(401);
  });
});

describe('session expiry', () => {
  async function sessionFor(email: string) {
    await createTestUser(app.db, { email });
    const { token } = await loginOk(email);
    return { token, id: hashToken(token) };
  }

  it('rejects a session past its absolute expiry and deletes it', async () => {
    const { token, id } = await sessionFor('expired@newsroom.example');
    await app.db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(sessions.id, id));

    const res = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: token } });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('SESSION_EXPIRED');
    expect(res.cookies.find((c) => c.name === SESSION_COOKIE)?.value).toBe('');
    expect(await app.db.select().from(sessions)).toHaveLength(0);
  });

  it('rejects a session idle for longer than 12 hours', async () => {
    const { token, id } = await sessionFor('idle@newsroom.example');
    await app.db
      .update(sessions)
      .set({ lastSeenAt: new Date(Date.now() - SESSION_IDLE_TTL_MS - 60_000) })
      .where(eq(sessions.id, id));

    const res = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: token } });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('SESSION_EXPIRED');
  });

  it('ends all sessions of a deactivated user', async () => {
    const { token } = await sessionFor('deactivated@newsroom.example');
    await app.db.update(users).set({ isActive: false }).where(eq(users.email, 'deactivated@newsroom.example'));

    const res = await app.inject({ method: 'GET', url: ME, cookies: { [SESSION_COOKIE]: token } });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('UNAUTHORIZED');
    expect(await app.db.select().from(sessions)).toHaveLength(0);
  });
});

describe('requireRole', () => {
  async function getAs(role: 'reporter' | 'editor' | 'admin') {
    const email = `${role}-role@newsroom.example`;
    await createTestUser(app.db, { role, email });
    const { token } = await loginOk(email);
    return app.inject({ method: 'GET', url: '/__test/editor-only', cookies: { [SESSION_COOKIE]: token } });
  }

  it('allows a listed role', async () => {
    const res = await getAs('editor');

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ data: { role: 'editor' } });
  });

  it('forbids an unlisted role', async () => {
    const res = await getAs('reporter');

    expect(res.statusCode).toBe(403);
    expect(errorCode(res)).toBe('FORBIDDEN');
  });

  it('does not imply admin', async () => {
    const res = await getAs('admin');

    expect(res.statusCode).toBe(403);
  });

  it('returns 401 without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/__test/editor-only' });

    expect(res.statusCode).toBe(401);
    expect(errorCode(res)).toBe('UNAUTHORIZED');
  });
});
