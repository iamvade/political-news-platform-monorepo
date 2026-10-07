import { publicHomepageResponseSchema } from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { publicErrorResponses as errors } from '../../lib/routes';
import { getPublicHomepage } from './public.service';

/** /v1/public: the live homepage, resolved. */
export const homepagePublicRoutes: FastifyPluginAsyncZod = async (app) => {
  const mediaBase = app.env.MEDIA_PUBLIC_BASE_URL;

  app.get(
    '/homepage',
    {
      config: { cache: 'news' },
      schema: { tags: ['public'], summary: 'Hero, featured articles and category sections', response: { 200: publicHomepageResponseSchema, ...errors } },
    },
    async () => ({ data: await getPublicHomepage(app.db, mediaBase) }),
  );
};
