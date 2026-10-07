import { describe, expect, it } from 'vitest';
import { createS3Storage } from './storage';

describe('createS3Storage.presignPut', () => {
  const storage = createS3Storage({
    endpoint: 'https://acc123.r2.cloudflarestorage.com/',
    accessKeyId: 'AKIDEXAMPLE',
    secretAccessKey: 'secret',
    region: 'auto',
  });

  it('signs content-type and content-length into a path-style URL with the requested expiry', async () => {
    const { url, expiresAt } = await storage.presignPut('news-media-originals', 'originals/2026/10/a b.jpg', {
      contentType: 'image/jpeg',
      contentLength: 12345,
      expiresInSeconds: 600,
    });

    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://acc123.r2.cloudflarestorage.com/news-media-originals/originals/2026/10/a%20b.jpg');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('600');
    expect(parsed.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;content-type;host');
    expect(parsed.searchParams.get('X-Amz-Credential')).toMatch(/^AKIDEXAMPLE\/\d{8}\/auto\/s3\/aws4_request$/);
    expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(590_000);
  });
});
