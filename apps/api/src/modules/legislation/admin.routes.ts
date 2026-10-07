import {
  adminBillListResponseSchema,
  adminBillResponseSchema,
  adminBillStageListResponseSchema,
  adminBillStageResponseSchema,
  adminVoteListResponseSchema,
  adminVoteResponseSchema,
  billListQuerySchema,
  billStageListQuerySchema,
  createBillBodySchema,
  createBillStageBodySchema,
  createVoteBodySchema,
  idParamsSchema,
  importResultResponseSchema,
  replaceSponsorsBodySchema,
  updateBillBodySchema,
  updateBillStageBodySchema,
  updateVoteBodySchema,
  voteImportBodySchema,
  voteListQuerySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { deleteResponses, adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import { importVotes } from './import';
import * as service from './service';

const IMPORT_BODY_LIMIT = 5 * 1024 * 1024;

/** Protected admin scope: bills (+ sponsors), bill stages, votes (+ votes import). */
export const legislationAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const dataRoles = app.requireRole('data_editor', 'admin');
  const adminOnly = app.requireRole('admin');

  // --- Bills ---
  const billTags = ['bills'];
  app.get('/bills', { onRequest: dataRoles, schema: { tags: billTags, querystring: billListQuerySchema, response: { 200: adminBillListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listBills(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/bills/:id', { onRequest: dataRoles, schema: { tags: billTags, params: idParamsSchema, response: { 200: adminBillResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getBill(db, request.params.id),
  }));
  app.post('/bills', { onRequest: dataRoles, schema: { tags: billTags, security: csrfSecurity, body: createBillBodySchema, response: { 201: adminBillResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createBill(db, currentUser(request), request.body) }),
  );
  app.patch('/bills/:id', { onRequest: dataRoles, schema: { tags: billTags, security: csrfSecurity, params: idParamsSchema, body: updateBillBodySchema, response: { 200: adminBillResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updateBill(db, currentUser(request), request.params.id, request.body),
  }));
  app.put('/bills/:id/sponsors', { onRequest: dataRoles, schema: { tags: billTags, summary: 'Replace the sponsor list', security: csrfSecurity, params: idParamsSchema, body: replaceSponsorsBodySchema, response: { 200: adminBillResponseSchema, ...errors } } }, async (request) => ({
    data: await service.replaceSponsors(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/bills/:id', { onRequest: adminOnly, schema: { tags: billTags, summary: 'Hard delete (admin only); 409 if votes exist', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deleteBill(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });

  // --- Bill stages ---
  const stageTags = ['bill-stages'];
  app.get('/bill-stages', { onRequest: dataRoles, schema: { tags: stageTags, querystring: billStageListQuerySchema, response: { 200: adminBillStageListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listStages(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/bill-stages/:id', { onRequest: dataRoles, schema: { tags: stageTags, params: idParamsSchema, response: { 200: adminBillStageResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getStage(db, request.params.id),
  }));
  app.post('/bill-stages', { onRequest: dataRoles, schema: { tags: stageTags, security: csrfSecurity, body: createBillStageBodySchema, response: { 201: adminBillStageResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createStage(db, currentUser(request), request.body) }),
  );
  app.patch('/bill-stages/:id', { onRequest: dataRoles, schema: { tags: stageTags, security: csrfSecurity, params: idParamsSchema, body: updateBillStageBodySchema, response: { 200: adminBillStageResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updateStage(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/bill-stages/:id', { onRequest: adminOnly, schema: { tags: stageTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deleteStage(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });

  // --- Votes ---
  const voteTags = ['votes'];
  app.get('/votes', { onRequest: dataRoles, schema: { tags: voteTags, querystring: voteListQuerySchema, response: { 200: adminVoteListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listVotes(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/votes/:id', { onRequest: dataRoles, schema: { tags: voteTags, params: idParamsSchema, response: { 200: adminVoteResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getVote(db, request.params.id),
  }));
  app.post('/votes', { onRequest: dataRoles, schema: { tags: voteTags, security: csrfSecurity, body: createVoteBodySchema, response: { 201: adminVoteResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createVote(db, currentUser(request), request.body) }),
  );
  app.patch('/votes/:id', { onRequest: dataRoles, schema: { tags: voteTags, security: csrfSecurity, params: idParamsSchema, body: updateVoteBodySchema, response: { 200: adminVoteResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updateVote(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/votes/:id', { onRequest: adminOnly, schema: { tags: voteTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deleteVote(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });
  app.post(
    '/votes/import',
    {
      onRequest: dataRoles,
      bodyLimit: IMPORT_BODY_LIMIT,
      schema: { tags: voteTags, summary: 'Bulk upsert votes (dryRun returns the diff)', security: csrfSecurity, body: voteImportBodySchema, response: { 200: importResultResponseSchema, ...errors } },
    },
    async (request) => ({ data: await importVotes(db, currentUser(request), request.body) }),
  );
};
