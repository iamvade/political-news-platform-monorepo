// CLI: pnpm admin:create --email you@example.mn --name "Нэр"
// The password is prompted (hidden) or read from ADMIN_PASSWORD. It is never accepted as an argument,
// so it cannot end up in shell history.
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import { passwordSchema } from '@news/shared/schemas';
import { z } from 'zod';
import { createDb } from '../db/client';
import { AppError } from '../lib/errors';
import { createAdminUser } from '../modules/auth/service';

async function promptHidden(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true });
  // Suppress echo of typed characters while still printing the question.
  let muted = false;
  const internal = rl as unknown as { _writeToOutput: (text: string) => void };
  internal._writeToOutput = (text) => {
    if (!muted) stdout.write(text);
  };
  const answer = rl.question(question);
  muted = true;
  const value = await answer;
  rl.close();
  stdout.write('\n');
  return value;
}

async function readPassword(): Promise<string> {
  const fromEnv = process.env.ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  if (!stdin.isTTY) throw new Error('No TTY: set ADMIN_PASSWORD to provide the password non-interactively.');

  const first = await promptHidden('Password (12–256 chars): ');
  const second = await promptHidden('Repeat password: ');
  if (first !== second) throw new Error('Passwords do not match.');
  return first;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { email: { type: 'string' }, name: { type: 'string' } },
  });
  const email = z.email().safeParse(values.email);
  if (!email.success || !values.name) {
    throw new Error('Usage: pnpm admin:create --email you@example.mn --name "Display name"');
  }

  const databaseUrl = z.url({ protocol: /^postgres(ql)?$/ }).safeParse(process.env.DATABASE_URL);
  if (!databaseUrl.success) throw new Error('DATABASE_URL is not set (see apps/api/.env.example).');

  const password = await readPassword();
  if (!passwordSchema.safeParse(password).success) throw new Error('Password must be 12–256 characters.');

  const { db, sql } = createDb(databaseUrl.data, { max: 1 });
  try {
    const user = await createAdminUser(db, { email: email.data, displayName: values.name, password });
    console.log(`Created admin #${user.id} <${user.email}>.`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof AppError || err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
