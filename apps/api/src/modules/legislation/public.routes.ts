import { publicBillResponseSchema, publicParliamentWeekResponseSchema, slugParamsSchema } from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { publicErrorResponses as errors } from '../../lib/routes';
import { getBillDetail, getParliamentWeek } from './public.service';

/** /v1/public: bill detail with stages and grouped votes; parliament this week. */
export const legislationPublicRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bills/:slug',
    {
      config: { cache: 'profile' },
      schema: { tags: ['public'], summary: 'Bill with sponsors, stages and votes', params: slugParamsSchema, response: { 200: publicBillResponseSchema, ...errors } },
    },
    async (request) => ({ data: await getBillDetail(app.db, request.params.slug) }),
  );

  app.get(
    '/parliament/week',
    {
      config: { cache: 'news' },
      schema: { tags: ['public'], summary: 'Bill stage changes and roll calls in the last 7 days (Ulaanbaatar)', response: { 200: publicParliamentWeekResponseSchema, ...errors } },
    },
    async () => ({ data: await getParliamentWeek(app.db) }),
  );
};
