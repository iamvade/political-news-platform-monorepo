import { publicBillResponseSchema, slugParamsSchema } from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { publicErrorResponses as errors } from '../../lib/routes';
import { getBillDetail } from './public.service';

/** /v1/public: bill detail with stages and grouped votes. */
export const legislationPublicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bills/:slug',
    {
      config: { cache: 'profile' },
      schema: { tags: ['public'], summary: 'Bill with sponsors, stages and votes', params: slugParamsSchema, response: { 200: publicBillResponseSchema, ...errors } },
    },
    async (request) => ({ data: await getBillDetail(app.db, request.params.slug) }),
  );
};
