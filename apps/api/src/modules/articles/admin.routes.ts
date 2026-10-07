import {
  articleListQuerySchema,
  articleListResponseSchema,
  articleResponseSchema,
  articleRevisionListResponseSchema,
  createArticleBodySchema,
  errorResponseSchema,
  idParamsSchema,
  paginationQuerySchema,
  restoreRevisionBodySchema,
  returnToDraftBodySchema,
  revisionParamsSchema,
  scheduleArticleBodySchema,
  updateArticleBodySchema,
  type AuthUser,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { csrfSecurity } from '../../plugins/swagger';
import {
  createArticle,
  getArticle,
  listArticles,
  listRevisions,
  publishArticle,
  restoreRevision,
  returnToDraft,
  scheduleArticle,
  submitArticle,
  unpublishArticle,
  updateArticle,
  type ArticleDeps,
} from './service';

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

/** Registered inside the protected admin scope: session + CSRF are already enforced; roles are checked here. */
export const articleAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const deps: ArticleDeps = { db: app.db, jobs: app.jobs, log: app.log };
  const newsroom = app.requireRole('reporter', 'editor', 'admin');
  const editorial = app.requireRole('editor', 'admin');
  const user = (request: { user: AuthUser | null }) => request.user!;
  const tags = ['articles'];

  app.get(
    '/articles',
    {
      onRequest: newsroom,
      schema: { tags, summary: 'List articles', querystring: articleListQuerySchema, response: { 200: articleListResponseSchema, ...errors } },
    },
    async (request) => {
      const { items, total } = await listArticles(deps, user(request), request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/articles/:id',
    {
      onRequest: newsroom,
      schema: { tags, summary: 'Get an article', params: idParamsSchema, response: { 200: articleResponseSchema, ...errors } },
    },
    async (request) => ({ data: await getArticle(deps, user(request), request.params.id) }),
  );

  app.post(
    '/articles',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Create a draft',
        security: csrfSecurity,
        body: createArticleBodySchema,
        response: { 201: articleResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      const article = await createArticle(deps, user(request), request.body);
      return reply.code(201).send({ data: article });
    },
  );

  app.patch(
    '/articles/:id',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Update content (published articles require `edit`)',
        security: csrfSecurity,
        params: idParamsSchema,
        body: updateArticleBodySchema,
        response: { 200: articleResponseSchema, ...errors },
      },
    },
    async (request) => ({ data: await updateArticle(deps, user(request), request.params.id, request.body) }),
  );

  app.post(
    '/articles/:id/submit',
    {
      onRequest: newsroom,
      schema: { tags, summary: 'draft → in_review', security: csrfSecurity, params: idParamsSchema, response: { 200: articleResponseSchema, ...errors } },
    },
    async (request) => ({ data: await submitArticle(deps, user(request), request.params.id) }),
  );

  app.post(
    '/articles/:id/return-to-draft',
    {
      onRequest: editorial,
      schema: {
        tags,
        summary: 'in_review → draft',
        security: csrfSecurity,
        params: idParamsSchema,
        // Fastify passes a missing body as null.
        body: returnToDraftBodySchema.nullish(),
        response: { 200: articleResponseSchema, ...errors },
      },
    },
    async (request) => ({ data: await returnToDraft(deps, user(request), request.params.id, request.body?.note) }),
  );

  app.post(
    '/articles/:id/publish',
    {
      onRequest: editorial,
      schema: { tags, summary: 'Publish now', security: csrfSecurity, params: idParamsSchema, response: { 200: articleResponseSchema, ...errors } },
    },
    async (request) => ({ data: await publishArticle(deps, user(request), request.params.id) }),
  );

  app.post(
    '/articles/:id/schedule',
    {
      onRequest: editorial,
      schema: {
        tags,
        summary: 'Schedule (or reschedule) publication',
        security: csrfSecurity,
        params: idParamsSchema,
        body: scheduleArticleBodySchema,
        response: { 200: articleResponseSchema, ...errors },
      },
    },
    async (request) => ({
      data: await scheduleArticle(deps, user(request), request.params.id, new Date(request.body.scheduledAt)),
    }),
  );

  app.post(
    '/articles/:id/unpublish',
    {
      onRequest: editorial,
      schema: { tags, summary: 'published | scheduled → draft', security: csrfSecurity, params: idParamsSchema, response: { 200: articleResponseSchema, ...errors } },
    },
    async (request) => ({ data: await unpublishArticle(deps, user(request), request.params.id) }),
  );

  app.get(
    '/articles/:id/revisions',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Revision history, newest first',
        params: idParamsSchema,
        querystring: paginationQuerySchema,
        response: { 200: articleRevisionListResponseSchema, ...errors },
      },
    },
    async (request) => {
      const { items, total } = await listRevisions(deps, user(request), request.params.id, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.post(
    '/articles/:id/revisions/:revisionId/restore',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Restore content from a revision (status unchanged)',
        security: csrfSecurity,
        params: revisionParamsSchema,
        body: restoreRevisionBodySchema.nullish(),
        response: { 200: articleResponseSchema, ...errors },
      },
    },
    async (request) => ({
      data: await restoreRevision(deps, user(request), request.params.id, request.params.revisionId, request.body?.edit),
    }),
  );
};
