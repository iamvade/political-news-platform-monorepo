import { createApiClient } from '@news/shared/api-client';
import { session } from './session';

/** The admin's API client: sends the session cookie and the in-memory CSRF token. */
export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL,
  credentials: 'include',
  getCsrfToken: () => session.get().csrfToken ?? undefined,
});
