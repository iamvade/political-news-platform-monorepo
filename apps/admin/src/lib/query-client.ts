import { isApiError } from '@news/shared/api-client';
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { notify } from './notify';
import { session } from './session';

/**
 * Any 401 from the API (no session, or SESSION_EXPIRED) ends the session. RequireAuth then redirects to
 * /login?next=<current page>. A toast explains why, but only if the user was signed in.
 */
function handleUnauthorized(client: QueryClient, err: unknown) {
  if (!isApiError(err) || err.status !== 401) return;
  if (session.get().status === 'authenticated') notify.info(i18n.t('auth.sessionExpired'));
  session.setAnonymous('expired');
  queueMicrotask(() => client.clear());
}

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (err) => handleUnauthorized(client, err) }),
    mutationCache: new MutationCache({ onError: (err) => handleUnauthorized(client, err) }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retry network/5xx once; never retry 4xx (auth, validation, not found).
        retry: (failures, err) => failures < 1 && !(isApiError(err) && err.status >= 400 && err.status < 500),
      },
    },
  });
  return client;
}
