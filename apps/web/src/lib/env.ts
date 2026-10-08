import 'server-only';
import { z } from 'zod';

const httpUrl = z.url({ protocol: /^https?$/ });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** API origin for server components (never exposed to the browser). */
  API_URL: httpUrl,
  /** Public origin of this site: canonical URLs, Open Graph and JSON-LD. Required in production. */
  SITE_URL: httpUrl.optional(),
  /** Shared with the API (WEB_REVALIDATE_SECRET). Without it /api/revalidate answers 503. */
  WEB_REVALIDATE_SECRET: z.string().min(32).optional(),
  /** Facebook app id for the `fb:app_id` meta tag (Sharing Debugger, share insights). Optional. */
  FACEBOOK_APP_ID: z.string().regex(/^\d+$/).optional(),
});

export type ServerEnv = z.infer<typeof schema>;

let cached: ServerEnv | undefined;

/** Validated server env, parsed on first use (so importing a module never fails at build time). */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new Error(`Invalid apps/web environment (${fields}); see apps/web/.env.example`);
    }
    cached = parsed.data;
  }
  return cached;
}

/** Absolute site origin without a trailing slash. Falls back to localhost outside production. */
export function siteUrl(): string {
  const env = serverEnv();
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, '');
  if (env.NODE_ENV === 'production') throw new Error('SITE_URL is required in production (see apps/web/.env.example)');
  return 'http://localhost:3000';
}

/** Tests only. */
export function resetServerEnv(): void {
  cached = undefined;
}
