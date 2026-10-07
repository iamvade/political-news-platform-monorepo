import { z } from 'zod';
import { dataResponse } from './common';
import { userRoleSchema } from './enums';

/** Password policy: 12–256 characters. The upper bound also caps argon2 work per request. */
export const passwordSchema = z.string().min(12).max(256);

export const loginBodySchema = z.object({
  email: z.email().max(320),
  // Login only checks the length cap; the policy minimum is enforced when a password is set.
  password: z.string().min(1).max(256),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authUserSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

/** Returned by login and `GET /me`. Send `csrfToken` as `X-CSRF-Token` on state-changing admin requests. */
export const authSessionSchema = z.object({
  user: authUserSchema,
  csrfToken: z.string(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;

export const authSessionResponseSchema = dataResponse(authSessionSchema);
