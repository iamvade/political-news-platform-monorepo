import { createHash } from 'node:crypto';
import { AwsClient } from 'aws4fetch';

/** Minimal object-storage surface used by the media pipeline. R2 in production, SeaweedFS locally, in-memory in tests. */
export interface ObjectStorage {
  /** Presigned PUT. `content-type` and `content-length` are signed, so the upload must match both. */
  presignPut(
    bucket: string,
    key: string,
    opts: { contentType: string; contentLength: number; expiresInSeconds: number },
  ): Promise<{ url: string; expiresAt: Date }>;
  head(bucket: string, key: string): Promise<{ size: number; contentType: string | null } | null>;
  /** Inclusive byte range. */
  getRange(bucket: string, key: string, start: number, end: number): Promise<Uint8Array>;
  getObject(bucket: string, key: string): Promise<Uint8Array>;
  putObject(bucket: string, key: string, body: Uint8Array, opts: { contentType: string; cacheControl?: string }): Promise<void>;
  deleteObject(bucket: string, key: string): Promise<void>;
  /** Creates the bucket if it does not exist. */
  ensureBucket(bucket: string): Promise<'created' | 'exists'>;
  /** Allows browsers on `origins` to PUT (presigned uploads) and GET. */
  setCors(bucket: string, origins: string[]): Promise<void>;
}

export interface S3StorageConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export class StorageError extends Error {}

/** S3-compatible storage over fetch + SigV4 (aws4fetch). Path-style URLs: `<endpoint>/<bucket>/<key>`. */
export function createS3Storage(config: S3StorageConfig): ObjectStorage {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  });
  const base = config.endpoint.replace(/\/+$/, '');
  const objectUrl = (bucket: string, key: string) =>
    `${base}/${encodeURIComponent(bucket)}/${key.split('/').map(encodeURIComponent).join('/')}`;

  async function send(url: string, init: RequestInit, okStatuses: number[] = []): Promise<Response> {
    const res = await client.fetch(url, init);
    if (!res.ok && !okStatuses.includes(res.status)) {
      const text = await res.text().catch(() => '');
      throw new StorageError(`${init.method ?? 'GET'} ${new URL(url).pathname} failed: HTTP ${res.status} ${text.slice(0, 200)}`);
    }
    return res;
  }

  return {
    async presignPut(bucket, key, opts) {
      const url = new URL(objectUrl(bucket, key));
      url.searchParams.set('X-Amz-Expires', String(opts.expiresInSeconds));
      const signed = await client.sign(url.toString(), {
        method: 'PUT',
        headers: { 'content-type': opts.contentType, 'content-length': String(opts.contentLength) },
        aws: { signQuery: true, allHeaders: true },
      });
      return { url: signed.url, expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000) };
    },

    async head(bucket, key) {
      const res = await send(objectUrl(bucket, key), { method: 'HEAD' }, [404]);
      if (res.status === 404) return null;
      return { size: Number(res.headers.get('content-length') ?? 0), contentType: res.headers.get('content-type') };
    },

    async getRange(bucket, key, start, end) {
      const res = await send(objectUrl(bucket, key), { method: 'GET', headers: { range: `bytes=${start}-${end}` } });
      return new Uint8Array(await res.arrayBuffer());
    },

    async getObject(bucket, key) {
      const res = await send(objectUrl(bucket, key), { method: 'GET' });
      return new Uint8Array(await res.arrayBuffer());
    },

    async putObject(bucket, key, body, opts) {
      const headers: Record<string, string> = { 'content-type': opts.contentType };
      if (opts.cacheControl) headers['cache-control'] = opts.cacheControl;
      await send(objectUrl(bucket, key), { method: 'PUT', headers, body });
    },

    async deleteObject(bucket, key) {
      await send(objectUrl(bucket, key), { method: 'DELETE' }, [404]);
    },

    async ensureBucket(bucket) {
      const head = await send(`${base}/${encodeURIComponent(bucket)}`, { method: 'HEAD' }, [404, 403]);
      if (head.ok) return 'exists';
      await send(`${base}/${encodeURIComponent(bucket)}`, { method: 'PUT' }, [409]);
      return 'created';
    },

    async setCors(bucket, origins) {
      const rules = origins
        .map((origin) => `<AllowedOrigin>${origin}</AllowedOrigin>`)
        .join('');
      const body =
        '<CORSConfiguration><CORSRule>' +
        rules +
        '<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>' +
        '<AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds>' +
        '</CORSRule></CORSConfiguration>';
      await send(`${base}/${encodeURIComponent(bucket)}?cors`, {
        method: 'PUT',
        headers: { 'content-type': 'application/xml', 'content-md5': createHash('md5').update(body).digest('base64') },
        body,
      });
    },
  };
}
