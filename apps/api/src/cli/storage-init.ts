// CLI: pnpm storage:init — creates the media buckets if missing and sets CORS on the originals bucket
// (browsers PUT originals directly with presigned URLs). Works against R2 and local SeaweedFS.
import { loadEnv } from '../config/env';
import { createS3Storage } from '../lib/storage';

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.MEDIA_ORIGINALS_BUCKET || !env.MEDIA_PUBLIC_BUCKET) {
    throw new Error('Storage is not configured (S3_* and MEDIA_*_BUCKET env vars).');
  }
  const storage = createS3Storage({
    endpoint: env.S3_ENDPOINT,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    region: env.S3_REGION,
  });

  for (const bucket of [env.MEDIA_ORIGINALS_BUCKET, env.MEDIA_PUBLIC_BUCKET]) {
    console.log(`${bucket}: ${await storage.ensureBucket(bucket)}`);
  }

  try {
    await storage.setCors(env.MEDIA_ORIGINALS_BUCKET, env.CORS_ORIGINS);
    console.log(`${env.MEDIA_ORIGINALS_BUCKET}: CORS allows ${env.CORS_ORIGINS.join(', ') || '(no origins)'}`);
  } catch (err) {
    // Some S3-compatible dev servers do not implement PutBucketCors; R2 does.
    console.warn(`Could not set CORS (${err instanceof Error ? err.message : err}). Configure it in the dashboard if needed.`);
  }
  console.log('Reminder: only the public bucket may be exposed via MEDIA_PUBLIC_BASE_URL; keep originals private.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
