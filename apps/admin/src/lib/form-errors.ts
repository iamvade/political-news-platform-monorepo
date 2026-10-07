import { isApiError } from '@news/shared/api-client';
import i18n from '../i18n';

export type FieldErrors = Record<string, string>;

/** Field errors from an API VALIDATION_ERROR (`body.sourceUrl` → `sourceUrl`); empty for any other error. */
export function apiFieldErrors(err: unknown): FieldErrors {
  if (!isApiError(err) || err.code !== 'VALIDATION_ERROR' || !err.details) return {};
  const errors: FieldErrors = {};
  for (const issue of err.details) {
    const field = issue.path.replace(/^(body|querystring|params)\./, '').split('.')[0];
    if (field) errors[field] ??= i18n.t('form.invalid');
  }
  return errors;
}

/** Field errors from a shared Zod schema's `safeParse` result (checked before sending). */
export function schemaFieldErrors(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }): FieldErrors {
  const errors: FieldErrors = {};
  if (result.success || !result.error) return errors;
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string') errors[field] ??= i18n.t('form.invalid');
  }
  return errors;
}

/** `''` → null for optional text inputs. */
export const orNull = (value: string) => (value.trim() === '' ? null : value.trim());
