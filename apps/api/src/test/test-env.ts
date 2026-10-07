/**
 * Environment for the test suite. Deliberately does NOT read DATABASE_URL / REDIS_URL,
 * so a dev or production URL in the shell can never leak into tests.
 */
export const testEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://news:news@localhost:5433/news_test',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/15',
  CORS_ORIGINS: 'http://localhost:5173',
  AUTH_SECRET: 'test-auth-secret-not-for-production-use-0123456789',
  // All test requests share one IP; route-specific limits (login, rate-limit tests) still apply.
  RATE_LIMIT_MAX: '1000000',
  // Media: buckets + base URL; the storage client itself is an in-memory fake (see test/memory-storage.ts).
  S3_ENDPOINT: 'http://storage.test',
  S3_ACCESS_KEY_ID: 'test',
  S3_SECRET_ACCESS_KEY: 'test',
  MEDIA_ORIGINALS_BUCKET: 'test-originals',
  MEDIA_PUBLIC_BUCKET: 'test-public',
  MEDIA_PUBLIC_BASE_URL: 'https://media.test',
  MEDIA_MAX_BYTES: '1048576',
} as const;

export function assertTestDatabase(url: string): void {
  const dbName = new URL(url).pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to run tests against database "${dbName}": name must end with "_test".`);
  }
}
