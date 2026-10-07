import { buildApp, type BuildAppOptions } from '../app';
import { loadEnv } from '../config/env';
import { createFakeJobs } from './fake-jobs';
import { createMemoryStorage } from './memory-storage';
import { assertTestDatabase } from './test-env';

/**
 * Builds the app against the test environment set in vitest.config.ts. Uses fake jobs and in-memory storage
 * unless given, so tests never enqueue real BullMQ work or touch real buckets. Remember to `await app.close()`.
 */
export async function buildTestApp(options: BuildAppOptions = {}) {
  const env = loadEnv();
  assertTestDatabase(env.DATABASE_URL);
  return buildApp(env, { jobs: createFakeJobs(), storage: createMemoryStorage(), ...options });
}
