import fp from 'fastify-plugin';
import { createS3Storage, type ObjectStorage } from '../lib/storage';

export interface MediaStorage {
  client: ObjectStorage;
  originalsBucket: string;
  publicBucket: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Null when S3_* / MEDIA_*_BUCKET env vars are not set; media routes then return 503. */
    storage: MediaStorage | null;
  }
}

/** Decorates `app.storage`. Pass `client` to inject a fake (tests); otherwise built from env. */
export const storagePlugin = fp<{ client?: ObjectStorage | null }>(
  async (app, opts) => {
    const { env } = app;
    let client = opts.client ?? null;
    if (opts.client === undefined && env.S3_ENDPOINT && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
      client = createS3Storage({
        endpoint: env.S3_ENDPOINT,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        region: env.S3_REGION,
      });
    }
    const configured = client && env.MEDIA_ORIGINALS_BUCKET && env.MEDIA_PUBLIC_BUCKET;
    app.decorate(
      'storage',
      configured ? { client: client!, originalsBucket: env.MEDIA_ORIGINALS_BUCKET!, publicBucket: env.MEDIA_PUBLIC_BUCKET! } : null,
    );
  },
  { name: 'storage' },
);
