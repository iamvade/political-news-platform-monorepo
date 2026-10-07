# Admin authentication

## Overview

**Built.** Email + password login for newsroom staff, server-side sessions in Postgres, `HttpOnly` cookies, CSRF protection, login rate limiting, and role checks. TOTP 2FA (required by the PRD) is **not built yet**.

## How it works

```mermaid
sequenceDiagram
  participant B as Browser (admin)
  participant A as API
  participant DB as Postgres
  B->>A: POST /v1/admin/auth/login {email, password}
  A->>DB: user by lower(email); argon2 verify
  A->>DB: insert session (id = sha256(token))
  A-->>B: Set-Cookie sid=<token>; {user, csrfToken}
  B->>A: PATCH /v1/admin/… (cookie + X-CSRF-Token)
  A->>DB: session by sha256(cookie) + user
  A-->>B: 200 / 401 / 403
```

- **Sessions**: a 32-byte random token goes in the cookie; the DB stores only its sha256. Absolute lifetime **7 days**, idle timeout **12 hours**, `last_seen_at` refreshed at most every 5 minutes. Expired sessions are deleted on access (401 `SESSION_EXPIRED`); deactivating a user deletes all of their sessions.
- **Cookie** `sid`: `HttpOnly; SameSite=Strict; Path=/; Secure` (from `SESSION_COOKIE_SECURE`), `Max-Age` 7 days.
- **Login** failures (wrong password, unknown email, invite-pending, inactive) all return the same 401 `INVALID_CREDENTIALS`; unknown emails still run argon2 against a dummy hash so timing does not reveal accounts.
- **CSRF**, three layers:
  1. `SameSite=Strict` cookie.
  2. Origin check on every non-GET `/v1/admin/*` request: the `Origin` must be the API's own origin (e.g. Swagger UI) or listed in `CORS_ORIGINS`, else 403 `CSRF_INVALID`.
  3. `X-CSRF-Token` on every non-GET authenticated request: `base64url(HMAC-SHA256(AUTH_SECRET, sessionId))`, compared in constant time. Returned by `login` and `GET /me`.
- **Rate limits** on login: 20 / 15 min per IP (route config) **and** 5 / 15 min per IP + lowercased email (`app.createRateLimit`) → 429 `RATE_LIMITED` with `Retry-After`.
- **Roles**: `admin`, `editor`, `reporter`, `data_editor`. `requireRole(...)` is explicit — `admin` does **not** implicitly pass `requireRole('editor')`; routes list every allowed role.
- **Hook order**: `verifyOrigin`, `requireAuth`, `verifyCsrf` and `requireRole` all run in `onRequest`, before body validation.

Routes: `POST /v1/admin/auth/login`, `GET /v1/admin/auth/me`, `POST /v1/admin/auth/logout` (204).

## Tech used

@fastify/cookie, @node-rs/argon2 (argon2id, 19 MiB, t=2, p=1), @fastify/rate-limit (Redis store), Node `crypto` (sha256, HMAC, `timingSafeEqual`).

## How to start

```bash
pnpm admin:create --email you@example.mn --name "Нэр"
```

Then log in via Swagger (see [getting-started](../getting-started.md#log-in-from-swagger)) or `curl`:

```bash
curl -c jar -H 'origin: http://localhost:4000' -H 'content-type: application/json' \
  -d '{"email":"you@example.mn","password":"…"}' localhost:4000/v1/admin/auth/login
```

## How to maintain

- New admin routes go inside the protected scope in `app.ts` (auth + CSRF already applied) and add `onRequest: app.requireRole(...)` per route; non-GET routes also set `schema.security: csrfSecurity` for Swagger.
- Password policy is `passwordSchema` (12–256 chars) in `@news/shared/schemas/auth.ts`.
- Tests: `modules/auth/auth.test.ts` (login, rate limits, expiry, CSRF, roles), `service.test.ts` (admin CLI). Use `signIn(app, role)` in other tests.

## Notables

- **`@fastify/rate-limit` runs only one of its handlers per request** (a shared per-request flag). A second limiter on the login route via `app.rateLimit()` silently never counted; the per-email limiter uses `app.createRateLimit()` inside a custom preHandler instead.
- Auth used to run in `preHandler`, after validation — anonymous callers got 400s that revealed request schemas. Fixed: all auth/role hooks are `onRequest`.
- Swagger UI is served by the API itself, so its requests carry `Origin: http://localhost:4000`; same-origin requests are allowed by design.
- Safari does not keep `Secure` cookies on `http://localhost` — use `SESSION_COOKIE_SECURE=false` locally (startup refuses it in production).
- Follow-ups: TOTP 2FA, periodic cleanup of expired session rows, password reset/invite flow, user management routes.

## Key files

`apps/api/src/plugins/auth.ts`, `apps/api/src/modules/auth/{admin.routes,service}.ts`, `apps/api/src/lib/password.ts`, `apps/api/src/cli/create-admin.ts`, `packages/shared/src/schemas/auth.ts`.

---
Last updated: 2026-10-07 — initial version.
