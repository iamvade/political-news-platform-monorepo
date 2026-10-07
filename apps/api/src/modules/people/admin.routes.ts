import {
  adminOrganizationListResponseSchema,
  adminOrganizationResponseSchema,
  adminPersonListResponseSchema,
  adminPersonResponseSchema,
  adminPositionListResponseSchema,
  adminPositionResponseSchema,
  createOrganizationBodySchema,
  createPersonBodySchema,
  createPositionBodySchema,
  idParamsSchema,
  importResultResponseSchema,
  organizationListQuerySchema,
  personListQuerySchema,
  positionImportBodySchema,
  positionListQuerySchema,
  updateOrganizationBodySchema,
  updatePersonBodySchema,
  updatePositionBodySchema,
} from '@news/shared/schemas';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { paginate } from '../../lib/crud';
import { deleteResponses, adminErrorResponses as errors, currentUser } from '../../lib/routes';
import { csrfSecurity } from '../../plugins/swagger';
import { importPositions } from './import';
import * as service from './service';

const IMPORT_BODY_LIMIT = 5 * 1024 * 1024;

/** Protected admin scope: persons, organizations, positions (+ positions import). */
export const peopleAdminRoutes: FastifyPluginAsyncZod = async (app) => {
  const { db } = app;
  const dataRoles = app.requireRole('data_editor', 'admin');
  const adminOnly = app.requireRole('admin');

  // --- Persons ---
  const personTags = ['persons'];
  app.get('/persons', { onRequest: dataRoles, schema: { tags: personTags, querystring: personListQuerySchema, response: { 200: adminPersonListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listPersons(db, currentUser(request), request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/persons/:id', { onRequest: dataRoles, schema: { tags: personTags, params: idParamsSchema, response: { 200: adminPersonResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getPerson(db, request.params.id),
  }));
  app.post('/persons', { onRequest: dataRoles, schema: { tags: personTags, security: csrfSecurity, body: createPersonBodySchema, response: { 201: adminPersonResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createPerson(db, currentUser(request), request.body) }),
  );
  app.patch('/persons/:id', { onRequest: dataRoles, schema: { tags: personTags, security: csrfSecurity, params: idParamsSchema, body: updatePersonBodySchema, response: { 200: adminPersonResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updatePerson(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/persons/:id', { onRequest: dataRoles, schema: { tags: personTags, summary: 'Soft delete', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deletePerson(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });

  // --- Organizations ---
  const orgTags = ['organizations'];
  app.get('/organizations', { onRequest: dataRoles, schema: { tags: orgTags, querystring: organizationListQuerySchema, response: { 200: adminOrganizationListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listOrganizations(db, currentUser(request), request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/organizations/:id', { onRequest: dataRoles, schema: { tags: orgTags, params: idParamsSchema, response: { 200: adminOrganizationResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getOrganization(db, request.params.id),
  }));
  app.post('/organizations', { onRequest: dataRoles, schema: { tags: orgTags, security: csrfSecurity, body: createOrganizationBodySchema, response: { 201: adminOrganizationResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createOrganization(db, currentUser(request), request.body) }),
  );
  app.patch('/organizations/:id', { onRequest: dataRoles, schema: { tags: orgTags, security: csrfSecurity, params: idParamsSchema, body: updateOrganizationBodySchema, response: { 200: adminOrganizationResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updateOrganization(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/organizations/:id', { onRequest: dataRoles, schema: { tags: orgTags, summary: 'Soft delete', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deleteOrganization(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });

  // --- Positions ---
  const positionTags = ['positions'];
  app.get('/positions', { onRequest: dataRoles, schema: { tags: positionTags, querystring: positionListQuerySchema, response: { 200: adminPositionListResponseSchema, ...errors } } }, async (request) => {
    const { items, total } = await service.listPositions(db, request.query);
    return paginate(items, total, request.query.page, request.query.pageSize);
  });
  app.get('/positions/:id', { onRequest: dataRoles, schema: { tags: positionTags, params: idParamsSchema, response: { 200: adminPositionResponseSchema, ...errors } } }, async (request) => ({
    data: await service.getPosition(db, request.params.id),
  }));
  app.post('/positions', { onRequest: dataRoles, schema: { tags: positionTags, security: csrfSecurity, body: createPositionBodySchema, response: { 201: adminPositionResponseSchema, ...errors } } }, async (request, reply) =>
    reply.code(201).send({ data: await service.createPosition(db, currentUser(request), request.body) }),
  );
  app.patch('/positions/:id', { onRequest: dataRoles, schema: { tags: positionTags, security: csrfSecurity, params: idParamsSchema, body: updatePositionBodySchema, response: { 200: adminPositionResponseSchema, ...errors } } }, async (request) => ({
    data: await service.updatePosition(db, currentUser(request), request.params.id, request.body),
  }));
  app.delete('/positions/:id', { onRequest: adminOnly, schema: { tags: positionTags, summary: 'Hard delete (admin only)', security: csrfSecurity, params: idParamsSchema, response: deleteResponses } }, async (request, reply) => {
    await service.deletePosition(db, currentUser(request), request.params.id);
    return reply.code(204).send();
  });
  app.post(
    '/positions/import',
    {
      onRequest: dataRoles,
      bodyLimit: IMPORT_BODY_LIMIT,
      schema: { tags: positionTags, summary: 'Bulk upsert positions (dryRun returns the diff)', security: csrfSecurity, body: positionImportBodySchema, response: { 200: importResultResponseSchema, ...errors } },
    },
    async (request) => ({ data: await importPositions(db, currentUser(request), request.body) }),
  );
};
