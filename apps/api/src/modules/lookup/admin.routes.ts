import { LOOKUP_KINDS, lookupQuerySchema, lookupResponseSchema } from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { adminErrorResponses as errors } from '../../lib/routes';
import { lookup } from './service';

/** Protected admin scope: picker lookups for the article editor (every newsroom role). */
export const lookupAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const newsroom = app.requireRole('reporter', 'editor', 'admin', 'data_editor');
  const mediaBase = app.env.MEDIA_PUBLIC_BASE_URL;
  const tags = ['lookup'];

  for (const kind of LOOKUP_KINDS) {
    app.get(
      `/lookup/${kind}`,
      {
        onRequest: newsroom,
        schema: {
          tags,
          summary: `Search ${kind} for editor pickers, or hydrate selected ones with ids=1,2`,
          querystring: lookupQuerySchema,
          response: { 200: lookupResponseSchema, ...errors },
        },
      },
      async (request) => ({ data: await lookup(app.db, mediaBase, kind, request.query) }),
    );
  }
};
