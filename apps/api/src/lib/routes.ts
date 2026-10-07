import { errorResponseSchema, noContentSchema, type AuthUser } from '@news/shared/schemas';
import type { FastifyRequest } from 'fastify';

/** Error responses shared by admin routes (documented in OpenAPI, serialized with the standard shape). */
export const adminErrorResponses = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Error responses for public routes. */
export const publicErrorResponses = {
  400: errorResponseSchema,
  404: errorResponseSchema,
  410: errorResponseSchema,
};

/** DELETE routes: 204 with no body, plus the standard errors. */
export const deleteResponses = { 204: noContentSchema, ...adminErrorResponses };

/** The authenticated user. Only call on routes behind requireAuth/requireRole. */
export function currentUser(request: FastifyRequest): AuthUser {
  if (!request.user) throw new Error('currentUser() called on an unauthenticated route');
  return request.user;
}
