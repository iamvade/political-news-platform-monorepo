import {
  paginationQuerySchema,
  publicArticleListResponseSchema,
  publicDeclarationListResponseSchema,
  publicOrganizationResponseSchema,
  publicPersonResponseSchema,
  publicPersonVoteListResponseSchema,
  publicPositionListResponseSchema,
  publicPromiseListResponseSchema,
  publicStatementListResponseSchema,
  slugParamsSchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { publicErrorResponses as errors } from '../../lib/routes';
import { listPublishedArticles } from '../articles/public.service';
import * as pub from './public.service';

/** /v1/public: person profiles (+ paginated sub-resources) and organizations. */
export const peoplePublicRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const mediaBase = app.env.MEDIA_PUBLIC_BASE_URL;
  const tags = ['public'];

  app.get(
    '/persons/:slug',
    { config: { cache: 'profile' }, schema: { tags, summary: 'Person profile', params: slugParamsSchema, response: { 200: publicPersonResponseSchema, ...errors } } },
    async (request) => ({ data: await pub.getPersonProfile(db, mediaBase, request.params.slug) }),
  );

  app.get(
    '/persons/:slug/positions',
    { config: { cache: 'profile' }, schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicPositionListResponseSchema, ...errors } } },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { items, total } = await pub.listPersonPositions(db, personId, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/persons/:slug/votes',
    { config: { cache: 'profile' }, schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicPersonVoteListResponseSchema, ...errors } } },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { items, total } = await pub.listPersonVotes(db, personId, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/persons/:slug/statements',
    { config: { cache: 'profile' }, schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicStatementListResponseSchema, ...errors } } },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { items, total } = await pub.listPersonStatements(db, personId, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/persons/:slug/promises',
    { config: { cache: 'profile' }, schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicPromiseListResponseSchema, ...errors } } },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { items, total } = await pub.listPersonPromises(db, personId, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/persons/:slug/declarations',
    { config: { cache: 'profile' }, schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicDeclarationListResponseSchema, ...errors } } },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { items, total } = await pub.listPersonDeclarations(db, personId, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/persons/:slug/articles',
    {
      config: { cache: 'news' },
      schema: { tags, summary: 'Published articles tagging this person', params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicArticleListResponseSchema, ...errors } },
    },
    async (request) => {
      const personId = await pub.personIdBySlug(db, request.params.slug);
      const { page, pageSize } = request.query;
      const { items, total } = await listPublishedArticles(db, mediaBase, { personId, page, pageSize });
      return paginate(items, total, page, pageSize);
    },
  );

  app.get(
    '/organizations/:slug',
    { config: { cache: 'profile' }, schema: { tags, summary: 'Organization with current members', params: slugParamsSchema, response: { 200: publicOrganizationResponseSchema, ...errors } } },
    async (request) => ({ data: await pub.getOrganizationDetail(db, mediaBase, request.params.slug) }),
  );
};
