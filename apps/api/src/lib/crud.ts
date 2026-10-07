import { ErrorCode } from '@news/shared/schemas';
import { AppError } from './errors';

export function paginate<T>(items: T[], total: number, page: number, pageSize: number) {
  return { data: items, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
}

export function notFound(entity: string): AppError {
  return new AppError(404, ErrorCode.NOT_FOUND, `${entity} not found`);
}

export const iso = (date: Date) => date.toISOString();
export const isoOrNull = (date: Date | null) => (date ? date.toISOString() : null);

const comparable = (value: unknown) => (value instanceof Date ? value.toISOString() : JSON.stringify(value ?? null));

/** `{ field: { from, to } }` for fields whose value changed between two row snapshots. */
export function diffOf(before: Record<string, unknown>, after: Record<string, unknown>) {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    if (comparable(before[key]) !== comparable(after[key])) diff[key] = { from: before[key] ?? null, to: after[key] ?? null };
  }
  return diff;
}

/** Drops undefined values so a PATCH body only touches the fields it sends. */
export function definedOnly<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** ILIKE pattern for a user-supplied search term: `%term%` with LIKE wildcards escaped. */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** 400 when a PATCH body sets nothing. */
export function assertHasChanges(changes: Record<string, unknown>): void {
  if (Object.keys(changes).length === 0) throw new AppError(400, ErrorCode.VALIDATION_ERROR, 'Nothing to update');
}

