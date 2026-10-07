import {
  adminMediaListResponseSchema,
  adminMediaResponseSchema,
  errorResponseSchema,
  idParamsSchema,
  mediaListQuerySchema,
  requestUploadBodySchema,
  requestUploadResponseSchema,
  updateMediaBodySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { adminErrorResponses, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import * as service from './service';

const errors = { ...adminErrorResponses, 503: errorResponseSchema };

/** Protected admin scope: media library. Uploads go browser → R2 directly via presigned URLs. */
export const mediaAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const deps: service.MediaDeps = {
    db: app.db,
    storage: app.storage,
    jobs: app.jobs,
    maxBytes: app.env.MEDIA_MAX_BYTES,
    publicBaseUrl: app.env.MEDIA_PUBLIC_BASE_URL,
    log: app.log,
  };
  const newsroom = app.requireRole('reporter', 'editor', 'admin', 'data_editor');
  const tags = ['media'];

  app.post(
    '/media/uploads',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Create a pending media row and a presigned PUT URL for the original',
        security: csrfSecurity,
        body: requestUploadBodySchema,
        response: { 201: requestUploadResponseSchema, ...errors },
      },
    },
    async (request, reply) => reply.code(201).send({ data: await service.requestUpload(deps, currentUser(request), request.body) }),
  );

  app.post(
    '/media/:id/confirm',
    {
      onRequest: newsroom,
      schema: {
        tags,
        summary: 'Verify the uploaded original and queue WebP variant generation',
        security: csrfSecurity,
        params: idParamsSchema,
        response: { 200: adminMediaResponseSchema, ...errors },
      },
    },
    async (request) => ({ data: await service.confirmUpload(deps, currentUser(request), request.params.id) }),
  );

  app.get(
    '/media',
    { onRequest: newsroom, schema: { tags, summary: 'Media library (search alt/credit)', querystring: mediaListQuerySchema, response: { 200: adminMediaListResponseSchema, ...errors } } },
    async (request) => {
      const { items, total } = await service.listMedia(deps, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );

  app.get(
    '/media/:id',
    { onRequest: newsroom, schema: { tags, params: idParamsSchema, response: { 200: adminMediaResponseSchema, ...errors } } },
    async (request) => ({ data: await service.getMedia(deps, request.params.id) }),
  );

  app.patch(
    '/media/:id',
    {
      onRequest: newsroom,
      schema: { tags, summary: 'Edit alt text / credit', security: csrfSecurity, params: idParamsSchema, body: updateMediaBodySchema, response: { 200: adminMediaResponseSchema, ...errors } },
    },
    async (request) => ({ data: await service.updateMedia(deps, currentUser(request), request.params.id, request.body) }),
  );
};
