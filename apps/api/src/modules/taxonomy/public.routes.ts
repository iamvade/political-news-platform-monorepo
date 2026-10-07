import {
  paginationQuerySchema,
  publicArticleListResponseSchema,
  publicTaxonomyResponseSchema,
  slugParamsSchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { publicErrorResponses as errors } from '../../lib/routes';
import { getTaxonomy, listPublishedArticles } from '../articles/public.service';

/** /v1/public: categories and tags, each with a paginated list of published articles. */
export const taxonomyPublicRoutes: FastifyPluginAsyncZod = async (app) => {
  const mediaBase = app.env.MEDIA_PUBLIC_BASE_URL;
  const tags = ['public'];

  for (const kind of ['category', 'tag'] as const) {
    const base = kind === 'category' ? '/categories' : '/tags';

    app.get(
      `${base}/:slug`,
      { config: { cache: 'news' }, schema: { tags, params: slugParamsSchema, response: { 200: publicTaxonomyResponseSchema, ...errors } } },
      async (request) => ({ data: await getTaxonomy(app.db, kind, request.params.slug) }),
    );

    app.get(
      `${base}/:slug/articles`,
      {
        config: { cache: 'news' },
        schema: { tags, params: slugParamsSchema, querystring: paginationQuerySchema, response: { 200: publicArticleListResponseSchema, ...errors } },
      },
      async (request) => {
        const { slug } = request.params;
        await getTaxonomy(app.db, kind, slug); // 404 for an unknown category/tag
        const { page, pageSize } = request.query;
        const filter = kind === 'category' ? { categorySlug: slug } : { tagSlug: slug };
        const { items, total } = await listPublishedArticles(app.db, mediaBase, { ...filter, page, pageSize });
        return paginate(items, total, page, pageSize);
      },
    );
  }
};
