import type { ValidationIssue } from '../schemas/common';

/** Client-side codes for failures that never reached (or never came back from) the API. */
export const ClientErrorCode = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  HTTP_ERROR: 'HTTP_ERROR',
} as const;

export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status, or 0 when the request never completed. */
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ValidationIssue[],
  ) {
    super(message);
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
