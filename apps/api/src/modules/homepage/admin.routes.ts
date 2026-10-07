import {
  adminHomepageResponseSchema,
  homepageVersionListResponseSchema,
  paginationQuerySchema,
  saveHomepageBodySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import * as service from './service';

/** Protected admin scope: homepage layout (editors and admins, PRD §9.2). */
export const homepageAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const deps: service.HomepageDeps = { db: app.db, jobs: app.jobs, log: app.log };
  const editors = app.requireRole('editor', 'admin');
  const tags = ['homepage'];

  app.get(
    '/homepage',
    { onRequest: editors, schema: { tags, summary: 'The live layout with its pinned articles and categories', response: { 200: adminHomepageResponseSchema, ...errors } } },
    async () => ({ data: await service.getHomepage(app.db) }),
  );

  app.put(
    '/homepage',
    {
      onRequest: editors,
      schema: {
        tags,
        summary: 'Save a new live version (409 EDIT_CONFLICT if expectedVersion is stale)',
        security: csrfSecurity,
        body: saveHomepageBodySchema,
        response: { 200: adminHomepageResponseSchema, ...errors },
      },
    },
    async (request) => ({ data: await service.saveHomepage(deps, currentUser(request), request.body) }),
  );

  app.get(
    '/homepage/versions',
    { onRequest: editors, schema: { tags, summary: 'Saved versions, newest first', querystring: paginationQuerySchema, response: { 200: homepageVersionListResponseSchema, ...errors } } },
    async (request) => {
      const { items, total } = await service.listVersions(app.db, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );
};
