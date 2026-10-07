import { isApiError } from '@news/shared/api-client';
import { toast } from 'sonner';
import i18n from '../i18n';

/** Mongolian message for any error: `errors.<CODE>`, falling back to `errors.UNKNOWN`. */
export function errorMessage(err: unknown): string {
  const code = isApiError(err) ? err.code : 'UNKNOWN';
  const key = `errors.${code}`;
  return i18n.exists(key) ? i18n.t(key) : i18n.t('errors.UNKNOWN');
}

export const notify = {
  success: (message: string) => toast.success(message),
  info: (message: string) => toast.info(message),
  error: (message: string) => toast.error(message),
  apiError: (err: unknown) => toast.error(errorMessage(err)),
};
