import type { ObjectStorage } from '../lib/storage';

export interface PresignCall {
  bucket: string;
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}

export interface MemoryStorage extends ObjectStorage {
  objects: Map<string, { body: Uint8Array; contentType: string; cacheControl?: string }>;
  presigned: PresignCall[];
  /** Simulates the browser's direct PUT to the presigned URL. */
  upload(bucket: string, key: string, body: Uint8Array, contentType: string): void;
  reset(): void;
}

/** In-memory ObjectStorage for tests (R2 is mocked at the service boundary). */
export function createMemoryStorage(): MemoryStorage {
  const objects = new Map<string, { body: Uint8Array; contentType: string; cacheControl?: string }>();
  const presigned: PresignCall[] = [];
  const id = (bucket: string, key: string) => `${bucket}/${key}`;

  return {
    objects,
    presigned,
    upload(bucket, key, body, contentType) {
      objects.set(id(bucket, key), { body, contentType });
    },
    reset() {
      objects.clear();
      presigned.length = 0;
    },
    async presignPut(bucket, key, opts) {
      presigned.push({ bucket, key, ...opts });
      return {
        url: `https://storage.test/${bucket}/${key}?X-Amz-Expires=${opts.expiresInSeconds}&X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost`,
        expiresAt: new Date(Date.now() + opts.expiresInSeconds * 1000),
      };
    },
    async head(bucket, key) {
      const object = objects.get(id(bucket, key));
      return object ? { size: object.body.length, contentType: object.contentType } : null;
    },
    async getRange(bucket, key, start, end) {
      const object = objects.get(id(bucket, key));
      if (!object) throw new Error(`No object ${bucket}/${key}`);
      return object.body.subarray(start, end + 1);
    },
    async getObject(bucket, key) {
      const object = objects.get(id(bucket, key));
      if (!object) throw new Error(`No object ${bucket}/${key}`);
      return object.body;
    },
    async putObject(bucket, key, body, opts) {
      objects.set(id(bucket, key), { body, contentType: opts.contentType, cacheControl: opts.cacheControl });
    },
    async deleteObject(bucket, key) {
      objects.delete(id(bucket, key));
    },
    async ensureBucket() {
      return 'exists';
    },
    async setCors() {},
  };
}
