import { runMigrations } from '../db/migrator';
import { assertTestDatabase, testEnv } from './test-env';

export default async function setup(): Promise<void> {
  assertTestDatabase(testEnv.DATABASE_URL);
  await runMigrations(testEnv.DATABASE_URL);
}
