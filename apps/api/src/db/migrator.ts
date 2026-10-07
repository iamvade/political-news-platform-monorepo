import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/** Applies pending migrations from `apps/api/drizzle`. Resolved from the working directory (the api package root). */
export async function runMigrations(url: string): Promise<void> {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: path.resolve('drizzle') });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
