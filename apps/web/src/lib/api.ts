import 'server-only';
import { createApiClient, type ApiClient } from '@news/shared/api-client';

let client: ApiClient | undefined;

/** Server-side API client. Created lazily so `next build` does not need API_URL. */
export function getApi(): ApiClient {
  if (!client) {
    const baseUrl = process.env.API_URL;
    if (!baseUrl) throw new Error('API_URL is not set (see apps/web/.env.example)');
    client = createApiClient({ baseUrl });
  }
  return client;
}
