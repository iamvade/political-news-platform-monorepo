import { ErrorCode } from '@news/shared/schemas';
import { AppError } from './errors';

interface PgErrorFields {
  code?: string;
  constraint_name?: string;
  table_name?: string;
  message?: string;
}

/** Drizzle wraps driver errors; the Postgres fields live on `cause`. */
function pgFields(err: unknown): PgErrorFields | undefined {
  const candidate = (err as { cause?: unknown })?.cause ?? err;
  if (candidate && typeof candidate === 'object' && typeof (candidate as PgErrorFields).code === 'string') {
    return candidate as PgErrorFields;
  }
  return undefined;
}

/**
 * Maps constraint violations to API errors (used by the global error handler):
 * - FK on insert/update → 400 REFERENCE_NOT_FOUND; FK on delete → 409 IN_USE
 * - unique → 409 DUPLICATE; CHECK / NOT NULL → 400 VALIDATION_ERROR
 * Messages name the constraint, never SQL or values.
 */
export function mapDbError(err: unknown): AppError | undefined {
  const pg = pgFields(err);
  if (!pg) return undefined;
  const constraint = pg.constraint_name ?? 'unknown';

  switch (pg.code) {
    // ON DELETE RESTRICT raises restrict_violation (23001); NO ACTION raises foreign_key_violation (23503).
    case '23001':
      return new AppError(409, ErrorCode.IN_USE, `Record is still referenced (${constraint})`);
    case '23503':
      // Postgres phrases the delete case as "update or delete on table ... violates foreign key constraint".
      if (pg.message?.startsWith('update or delete on table')) {
        return new AppError(409, ErrorCode.IN_USE, `Record is still referenced (${constraint})`);
      }
      return new AppError(400, ErrorCode.REFERENCE_NOT_FOUND, `Referenced record does not exist (${constraint})`);
    case '23505':
      return new AppError(409, ErrorCode.DUPLICATE, `A record with these values already exists (${constraint})`);
    case '23514':
      return new AppError(400, ErrorCode.VALIDATION_ERROR, `Value violates rule ${constraint}`);
    case '23502':
      return new AppError(400, ErrorCode.VALIDATION_ERROR, 'A required field is missing');
    default:
      return undefined;
  }
}
