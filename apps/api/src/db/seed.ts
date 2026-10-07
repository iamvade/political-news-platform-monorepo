// CLI entry: `pnpm db:seed` (refuses if data exists) or `pnpm db:seed --reset` (wipes all tables first).
import { z } from 'zod';
import { resetDb } from '../test/reset-db';
import { createDb } from './client';
import { seed, SeedRefusedError } from './seeder';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed: NODE_ENV=production.');
  process.exit(1);
}

const url = z.url({ protocol: /^postgres(ql)?$/ }).parse(process.env.DATABASE_URL);
const reset = process.argv.includes('--reset');
const { db, sql } = createDb(url, { max: 1 });

try {
  if (reset) {
    await resetDb(db);
    console.log('All tables truncated.');
  }
  const counts = await seed(db);
  console.log('Seeded:', counts);
} catch (err) {
  if (err instanceof SeedRefusedError) {
    console.error(err.message);
  } else {
    console.error('Seed failed:', err);
  }
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
