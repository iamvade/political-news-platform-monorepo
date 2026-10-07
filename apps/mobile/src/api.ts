import { createApiClient } from '@news/shared/api-client';

const baseUrl = process.env.EXPO_PUBLIC_API_URL;
if (!baseUrl) throw new Error('EXPO_PUBLIC_API_URL is not set (see apps/mobile/.env.example)');

export const api = createApiClient({ baseUrl });
