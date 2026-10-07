import {
  adminCorrectionListResponseSchema,
  adminCorrectionResponseSchema,
  correctionListQuerySchema,
  createCorrectionBodySchema,
  idParamsSchema,
  updateCorrectionBodySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { deleteResponses, adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import * as service from './service';

/** Protected admin scope: the public corrections log. */
export const correctionsAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const dataRoles = app.requireRole('data_editor', 'admin');
  const adminOnly = app.requireRole('admin');
  const tags = ['corrections'];

  app.get('/corrections', { onRequest: dataRoles, schema: { tags, querystring: correctionListQuerySchema, response: { 200: adminCorrectionListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listCorrections(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/corrections/:id', { onRequest: dataRoles, schema: { tags, params: idParamsSchema, response: { 200: adminCorrectionResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getCorrection(db, request.params.id),
  }));
  app.post('/corrections', { onRequest: dataRoles, schema: { tags, security: csrfSecurity, body: createCorrectionBodySchema, response: { 201: adminCorrectionResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createCorrection(db, currentUser(request), request.body) }),
  );
  app.patch('/corrections/:id', { onRequest: dataRoles, schema: { tags, security: csrfSecurity, params: idParamsSchema, body: updateCorrectionBodySchema, response: { 200: adminCorrectionResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updateCorrection(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/corrections/:id', { onRequest: adminOnly, schema: { tags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deleteCorrection(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });
};
