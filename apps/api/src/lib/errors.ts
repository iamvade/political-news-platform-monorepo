import { ErrorCode, type ErrorResponse, type ValidationIssue } from '@news/shared/schemas';
import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { mapDbError } from './db-errors';

/** Throw this from services and handlers; the global error handler turns it into `{ error: { code, message } }`. */
export class AppError extends Error {
  override readonly name = 'AppError';

  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    /** Field/row issues, e.g. for IMPORT_INVALID. */
    readonly details?: ValidationIssue[],
  ) {
    super(message);
  }
}

function errorBody(code: string, message: string, details?: ValidationIssue[]): ErrorResponse {
  return { error: details ? { code, message, details } : { code, message } };
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError | AppError | Error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const details = err.validation.map((issue) => ({
        path: [err.validationContext, ...issue.instancePath.split('/').filter(Boolean)].filter(Boolean).join('.'),
        message: issue.message ?? 'Invalid value',
      }));
      return reply.code(400).send(errorBody(ErrorCode.VALIDATION_ERROR, 'Request validation failed', details));
    }

    const dbError = mapDbError(err);
    if (dbError) {
      return reply.code(dbError.statusCode).send(errorBody(dbError.code, dbError.message));
    }

    if (err instanceof AppError) {
      if (err.statusCode >= 500) request.log.error({ err }, err.message);
      return reply.code(err.statusCode).send(errorBody(err.code, err.message, err.details));
    }

    const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' ? err.statusCode : 500;

    // Framework/plugin client errors (bad JSON, unsupported media type, body too large...).
    if (statusCode >= 400 && statusCode < 500) {
      return reply.code(statusCode).send(errorBody(ErrorCode.BAD_REQUEST, err.message));
    }

    request.log.error({ err }, 'Unhandled error');
    return reply.code(500).send(errorBody(ErrorCode.INTERNAL_ERROR, 'Internal server error'));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.code(404).send(errorBody(ErrorCode.NOT_FOUND, `Route ${request.method} ${request.url} not found`));
  });
}
