import {
  publicArticleListQuerySchema,
  publicArticleListResponseSchema,
  publicArticleResponseSchema,
  slugParamsSchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { publicErrorResponses as errors } from '../../lib/routes';
import { getPublishedArticle, listPublishedArticles } from './public.service';

/** /v1/public: published articles only. */
export const articlePublicRoutes: FastifyPluginAsyncZod = async (app) => {
  const mediaBase = app.env.MEDIA_PUBLIC_BASE_URL;
  const tags = ['public'];

  app.get(
    '/articles',
    {
      config: { cache: 'news' },
      schema: { tags, summary: 'Published articles (filter by category/tag slug)', querystring: publicArticleListQuerySchema, response: { 200: publicArticleListResponseSchema, ...errors } },
    },
    async (request) => {
      const { category, tag, page, pageSize } = request.query;
      const { items, total } = await listPublishedArticles(app.db, mediaBase, { categorySlug: category, tagSlug: tag, page, pageSize });
      return paginate(items, total, page, pageSize);
    },
  );

  app.get(
    '/articles/:slug',
    {
      config: { cache: 'news' },
      schema: { tags, summary: 'Published article by slug (410 if unpublished)', params: slugParamsSchema, response: { 200: publicArticleResponseSchema, ...errors } },
    },
    async (request) => ({ data: await getPublishedArticle(app.db, mediaBase, request.params.slug) }),
  );
};
