// CLI entry: `pnpm db:migrate`
import { z } from 'zod';
import { runMigrations } from './migrator';

const url = z.url({ protocol: /^postgres(ql)?$/ }).parse(process.env.DATABASE_URL);

try {
  await runMigrations(url);
  console.log('Migrations applied.');
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
