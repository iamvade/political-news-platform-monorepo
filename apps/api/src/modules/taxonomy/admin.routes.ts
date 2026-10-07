import { createTagBodySchema, taxonomyItemResponseSchema } from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import * as service from './service';

/** Protected admin scope: taxonomy writes. Editors and admins create tags inline from the article editor. */
export const taxonomyAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const editors = app.requireRole('editor', 'admin');

  app.post(
    '/tags',
    {
      onRequest: editors,
      schema: { tags: ['taxonomy'], summary: 'Create a tag', security: csrfSecurity, body: createTagBodySchema, response: { 201: taxonomyItemResponseSchema, ...errors } },
    },
    async (request, reply) => reply.code(201).send({ data: await service.createTag(app.db, currentUser(request), request.body) }),
  );
};
