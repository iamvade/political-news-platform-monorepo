import { hash, verify, type Algorithm } from '@node-rs/argon2';

// `Algorithm` is a const enum, which isolatedModules cannot import as a value. 2 = Argon2id.
const ARGON2ID = 2 as Algorithm;

/** OWASP baseline for argon2id: 19 MiB memory, 2 iterations, 1 lane. */
const OPTIONS = { algorithm: ARGON2ID, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** Returns false (never throws) for a wrong password or a malformed hash. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * A real hash of a throwaway password. Verifying against it when the user does not exist keeps login timing
 * the same for unknown and known emails.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('timing-equaliser-not-a-real-password');
  return dummyHash;
}
