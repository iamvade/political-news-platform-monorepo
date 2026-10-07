import { z } from 'zod';

const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false', '1', '0'])
    .default(defaultValue)
    .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),

    CORS_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),
    TRUST_PROXY: booleanString('false'),

    /** HMAC key for CSRF tokens. Generate with: openssl rand -base64 48 */
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
    /** Only set to false for local dev in browsers that reject Secure cookies on http://localhost (Safari). */
    SESSION_COOKIE_SECURE: booleanString('true'),

    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    RATE_LIMIT_WINDOW: z.string().min(1).default('1 minute'),

    /** Run BullMQ workers inside this process. Set false when a separate worker process handles jobs. */
    WORKERS_ENABLED: booleanString('true'),
    /** Next.js on-demand revalidation endpoint. When unset, revalidate jobs are skipped. */
    WEB_REVALIDATE_URL: z.url({ protocol: /^https?$/ }).optional(),
    WEB_REVALIDATE_SECRET: z.string().min(32).optional(),

    /** Public base URL of the R2 media bucket (custom domain), e.g. https://media.example.mn. Media URLs are null without it. */
    MEDIA_PUBLIC_BASE_URL: z.url({ protocol: /^https?$/ }).optional(),

    /** S3-compatible storage (Cloudflare R2 in production, SeaweedFS locally). All-or-nothing; see refine below. */
    S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
    S3_ACCESS_KEY_ID: z.string().min(1).optional(),
    S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    S3_REGION: z.string().min(1).default('auto'),
    /** Private bucket for originals (full EXIF incl. GPS) — never public. */
    MEDIA_ORIGINALS_BUCKET: z.string().min(3).optional(),
    /** Public bucket for generated WebP variants, served via MEDIA_PUBLIC_BASE_URL. */
    MEDIA_PUBLIC_BUCKET: z.string().min(3).optional(),
    MEDIA_MAX_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  })
  .refine((env) => env.NODE_ENV !== 'production' || env.SESSION_COOKIE_SECURE, {
    message: 'SESSION_COOKIE_SECURE must be true in production',
    path: ['SESSION_COOKIE_SECURE'],
  })
  .refine(
    (env) => {
      const storage = [env.S3_ENDPOINT, env.S3_ACCESS_KEY_ID, env.S3_SECRET_ACCESS_KEY, env.MEDIA_ORIGINALS_BUCKET, env.MEDIA_PUBLIC_BUCKET];
      const set = storage.filter(Boolean).length;
      if (env.NODE_ENV === 'production') return set === storage.length && Boolean(env.MEDIA_PUBLIC_BASE_URL);
      return set === 0 || set === storage.length;
    },
    {
      message:
        'Set all of S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, MEDIA_ORIGINALS_BUCKET, MEDIA_PUBLIC_BUCKET (and MEDIA_PUBLIC_BASE_URL in production), or none',
      path: ['S3_ENDPOINT'],
    },
  )
  .refine((env) => !env.MEDIA_ORIGINALS_BUCKET || env.MEDIA_ORIGINALS_BUCKET !== env.MEDIA_PUBLIC_BUCKET, {
    message: 'Originals and public buckets must differ (originals contain EXIF/GPS)',
    path: ['MEDIA_PUBLIC_BUCKET'],
  })
  .refine((env) => !env.WEB_REVALIDATE_URL || env.WEB_REVALIDATE_SECRET, {
    message: 'WEB_REVALIDATE_SECRET is required when WEB_REVALIDATE_URL is set',
    path: ['WEB_REVALIDATE_SECRET'],
  });

export type Env = z.infer<typeof envSchema>;

declare module 'fastify' {
  interface FastifyInstance {
    /** Validated environment, decorated in buildApp(). */
    env: Env;
  }
}

/** Parses and validates the environment. Throws with a readable report on failure. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
