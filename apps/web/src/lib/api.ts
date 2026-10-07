import 'server-only';
import { createApiClient, type ApiClient } from '@news/shared/api-client';
import { serverEnv } from './env';

let client: ApiClient | undefined;

/** Server-side API client. Created lazily so `next build` only needs API_URL when a page fetches. */
export function getApi(): ApiClient {
  client ??= createApiClient({ baseUrl: serverEnv().API_URL });
  return client;
}
