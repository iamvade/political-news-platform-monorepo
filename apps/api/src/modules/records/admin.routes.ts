import {
  adminDeclarationListResponseSchema,
  adminDeclarationResponseSchema,
  adminPromiseListResponseSchema,
  adminPromiseResponseSchema,
  adminPromiseUpdateListResponseSchema,
  adminStatementListResponseSchema,
  adminStatementResponseSchema,
  createDeclarationBodySchema,
  createPromiseBodySchema,
  createStatementBodySchema,
  declarationListQuerySchema,
  idParamsSchema,
  paginationQuerySchema,
  promiseStatusChangeBodySchema,
  promiseListQuerySchema,
  statementListQuerySchema,
  updateDeclarationBodySchema,
  updatePromiseBodySchema,
  updateStatementBodySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { deleteResponses, adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import { cacheTags, personOrPeople, revalidateAfterCommit } from '../../lib/revalidate';
import * as service from './service';

/** Protected admin scope: statements, promises, declarations. */
export const recordsAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const dataRoles = app.requireRole('data_editor', 'admin');
  const adminOnly = app.requireRole('admin');

  // --- Statements ---
  const statementTags = ['statements'];
  app.get('/statements', { onRequest: dataRoles, schema: { tags: statementTags, querystring: statementListQuerySchema, response: { 200: adminStatementListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listStatements(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/statements/:id', { onRequest: dataRoles, schema: { tags: statementTags, params: idParamsSchema, response: { 200: adminStatementResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getStatement(db, request.params.id),
  }));
  app.post('/statements', { onRequest: dataRoles, schema: { tags: statementTags, security: csrfSecurity, body: createStatementBodySchema, response: { 201: adminStatementResponseSchema, ...errors } } }, async (request, reply) => {
    const saved = await service.createStatement(db, currentUser(request), request.body);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return reply.code(201).send({ data: saved });
  });
  app.patch('/statements/:id', { onRequest: dataRoles, schema: { tags: statementTags, security: csrfSecurity, params: idParamsSchema, body: updateStatementBodySchema, response: { 200: adminStatementResponseSchema, ...errors } } }, async (request) => {
    const saved = await service.updateStatement(db, currentUser(request), request.params.id, request.body);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return { data: saved };
  });
  app.delete('/statements/:id', { onRequest: adminOnly, schema: { tags: statementTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    const saved = await service.deleteStatement(db, currentUser(request), request.params.id);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return reply.code(204).send();
  });

  // --- Promises ---
  const promiseTags = ['promises'];
  app.get('/promises', { onRequest: dataRoles, schema: { tags: promiseTags, querystring: promiseListQuerySchema, response: { 200: adminPromiseListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listPromises(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/promises/:id', { onRequest: dataRoles, schema: { tags: promiseTags, params: idParamsSchema, response: { 200: adminPromiseResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getPromise(db, request.params.id),
  }));
  app.post('/promises', { onRequest: dataRoles, schema: { tags: promiseTags, security: csrfSecurity, body: createPromiseBodySchema, response: { 201: adminPromiseResponseSchema, ...errors } } }, async (request, reply) => {
    const saved = await service.createPromise(db, currentUser(request), request.body);
    await revalidateAfterCommit(app, personOrPeople(saved.personId));
    return reply.code(201).send({ data: saved });
  });
  app.patch('/promises/:id', { onRequest: dataRoles, schema: { tags: promiseTags, security: csrfSecurity, params: idParamsSchema, body: updatePromiseBodySchema, response: { 200: adminPromiseResponseSchema, ...errors } } }, async (request) => {
    const saved = await service.updatePromise(db, currentUser(request), request.params.id, request.body);
    await revalidateAfterCommit(app, personOrPeople(saved.personId));
    return { data: saved };
  });
  app.post(
    '/promises/:id/status',
    {
      onRequest: dataRoles,
      schema: {
        tags: promiseTags,
        summary: 'Change the status with a dated note and evidence URL (the only way to change status)',
        security: csrfSecurity,
        params: idParamsSchema,
        body: promiseStatusChangeBodySchema,
        response: { 200: adminPromiseResponseSchema, ...errors },
      },
    },
    async (request) => {
      const saved = await service.changePromiseStatus(db, currentUser(request), request.params.id, request.body);
      await revalidateAfterCommit(app, personOrPeople(saved.personId));
      return { data: saved };
    },
  );
  app.get(
    '/promises/:id/updates',
    {
      onRequest: dataRoles,
      schema: { tags: promiseTags, summary: 'Status history, newest first', params: idParamsSchema, querystring: paginationQuerySchema, response: { 200: adminPromiseUpdateListResponseSchema, ...errors } },
    },
    async (request) => {
      const { items, total } = await service.listPromiseUpdates(db, request.params.id, request.query);
      return paginate(items, total, request.query.page, request.query.pageSize);
    },
  );
  app.delete('/promises/:id', { onRequest: adminOnly, schema: { tags: promiseTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    const saved = await service.deletePromise(db, currentUser(request), request.params.id);
    await revalidateAfterCommit(app, personOrPeople(saved.personId));
    return reply.code(204).send();
  });

  // --- Declarations ---
  const declarationTags = ['declarations'];
  app.get('/declarations', { onRequest: dataRoles, schema: { tags: declarationTags, querystring: declarationListQuerySchema, response: { 200: adminDeclarationListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listDeclarations(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/declarations/:id', { onRequest: dataRoles, schema: { tags: declarationTags, params: idParamsSchema, response: { 200: adminDeclarationResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getDeclaration(db, request.params.id),
  }));
  app.post('/declarations', { onRequest: dataRoles, schema: { tags: declarationTags, security: csrfSecurity, body: createDeclarationBodySchema, response: { 201: adminDeclarationResponseSchema, ...errors } } }, async (request, reply) => {
    const saved = await service.createDeclaration(db, currentUser(request), request.body);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return reply.code(201).send({ data: saved });
  });
  app.patch('/declarations/:id', { onRequest: dataRoles, schema: { tags: declarationTags, security: csrfSecurity, params: idParamsSchema, body: updateDeclarationBodySchema, response: { 200: adminDeclarationResponseSchema, ...errors } } }, async (request) => {
    const saved = await service.updateDeclaration(db, currentUser(request), request.params.id, request.body);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return { data: saved };
  });
  app.delete('/declarations/:id', { onRequest: adminOnly, schema: { tags: declarationTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    const saved = await service.deleteDeclaration(db, currentUser(request), request.params.id);
    await revalidateAfterCommit(app, [cacheTags.person(saved.personId)]);
    return reply.code(204).send();
  });
};
