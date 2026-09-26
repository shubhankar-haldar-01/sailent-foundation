import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AppConfig } from '../../config/app.config.js';

/**
 * Object storage.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * THE PROVIDER IS BEHIND THIS AND NOWHERE ELSE.
 *
 * Nothing outside this file imports an S3 client, names a bucket, or builds a
 * URL from a storage key. That is the whole point: Cloudflare R2 was chosen in
 * Phase 0, it is S3-compatible, and if it is ever replaced the change is this
 * file rather than every module that stores a picture.
 *
 * R2 IS REACHED THROUGH THE S3 API, deliberately. It speaks S3 natively, so an
 * S3 client is the supported route and avoids a Cloudflare-specific SDK that
 * would tie the abstraction to the provider it exists to hide.
 * ══════════════════════════════════════════════════════════════════════════
 */

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super(
      'Object storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY and R2_PUBLIC_BASE_URL. No object was written.',
    );
    this.name = 'StorageNotConfiguredError';
  }
}

/** Which bucket an object belongs in, decided by its visibility. */
export type StorageBucket = 'public' | 'private';

@Injectable()
export class StorageService {
  private client: S3Client | null = null;

  constructor(private readonly config: AppConfig) {}

  /**
   * Whether storage can be used at all.
   *
   * Exposed so a caller can refuse an upload with a clear message BEFORE
   * reading a file into memory, rather than discovering it afterwards.
   */
  get isConfigured(): boolean {
    const env = this.config.env;
    return Boolean(
      env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_PUBLIC_BASE_URL,
    );
  }

  /**
   * The client, built once and only when storage is actually used.
   *
   * Lazily, because the vast majority of this application never touches
   * storage — the donation flow, volunteers, events and every public page work
   * without it — and constructing a client at boot would make missing
   * credentials a startup failure for work that does not need them. Production
   * still refuses to boot without them; that check lives in the config schema,
   * where it belongs.
   */
  private getClient(): S3Client {
    if (!this.isConfigured) throw new StorageNotConfiguredError();
    if (this.client) return this.client;

    const env = this.config.env;
    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });

    return this.client;
  }

  private bucketFor(bucket: StorageBucket): string {
    return bucket === 'public'
      ? this.config.env.R2_BUCKET_PUBLIC
      : this.config.env.R2_BUCKET_PRIVATE;
  }

  /**
   * Build a storage key that the uploader cannot influence.
   *
   * ══════════════════════════════════════════════════════════════════════════
   * THE ORIGINAL FILENAME IS NOT PART OF THE PATH. AT ALL.
   *
   * Not sanitised, not slugified — not used. A filename is attacker-controlled
   * input, and every scheme that "cleans" one is a scheme somebody eventually
   * gets past: `../`, encoded separators, a name that collides with an
   * existing object and silently replaces it, a trailing `.html` that decides
   * how a browser treats the response.
   *
   * The key is `<prefix>/<yyyy>/<mm>/<32 hex chars>.<ext>`, where the extension
   * comes from the type the BYTES were proved to be. There is nothing in it to
   * traverse with and nothing to collide with.
   *
   * The date segments are for humans reading a bucket listing, and cost
   * nothing.
   * ══════════════════════════════════════════════════════════════════════════
   */
  buildKey(options: { prefix: string; mimeType: string }): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      // Phase 10.10. A document is a PDF or a scan of one; the scan formats are
      // the image formats above, so only this line was missing.
      'application/pdf': 'pdf',
    };

    const extension = extensions[options.mimeType];
    if (!extension) {
      // Unreachable from the upload path, which proves the type first. Refusing
      // here rather than defaulting means a new format cannot slip through
      // with no extension and an ambiguous content type.
      throw new Error(`No storage extension is defined for ${options.mimeType}.`);
    }

    // A fixed, known-safe prefix vocabulary. Never caller-supplied free text.
    const prefix = options.prefix.replace(/[^a-z0-9-]/g, '') || 'media';

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    return `${prefix}/${year}/${month}/${randomBytes(16).toString('hex')}.${extension}`;
  }

  async put(
    bucket: StorageBucket,
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.bucketFor(bucket),
        Key: key,
        Body: body,
        ContentType: contentType,
        /*
          The content type is pinned on the object, from the sniffed type
          rather than the declared one. R2 serves it back on GET, so this is
          what decides whether a browser renders the response or runs it.
        */
        CacheControl: bucket === 'public' ? 'public, max-age=31536000, immutable' : 'private',
      }),
    );

    return { key, size: body.byteLength, contentType };
  }

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    await this.getClient().send(
      new DeleteObjectCommand({ Bucket: this.bucketFor(bucket), Key: key }),
    );
  }

  /**
   * Read an object back.
   *
   * Used when an image changes visibility: the two buckets differ in exactly
   * the way that matters — one has a public hostname — so the object has to
   * move, which means reading it first. Not used on any read path a visitor
   * can reach; public images are served by R2 directly, not proxied.
   */
  async read(bucket: StorageBucket, key: string): Promise<Buffer> {
    const result = await this.getClient().send(
      new GetObjectCommand({ Bucket: this.bucketFor(bucket), Key: key }),
    );

    const body = result.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) {
      throw new Error(`Could not read ${key} from the ${bucket} bucket.`);
    }

    return Buffer.from(await body.transformToByteArray());
  }

  /** Whether the object is actually there. Used to verify a round trip. */
  async exists(bucket: StorageBucket, key: string): Promise<boolean> {
    try {
      await this.getClient().send(
        new HeadObjectCommand({ Bucket: this.bucketFor(bucket), Key: key }),
      );
      return true;
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404 || status === 403) return false;
      throw error;
    }
  }

  /**
   * The public URL for a PUBLIC object.
   *
   * Returns null when storage is unconfigured rather than building a URL
   * against an empty host — a media row carrying `https://undefined/...` is
   * worse than one carrying no URL at all, because the database constraint
   * would accept it and a page would render a broken image.
   */
  publicUrl(key: string): string | null {
    const base = this.config.env.R2_PUBLIC_BASE_URL;
    if (!base) return null;
    return `${base.replace(/\/+$/, '')}/${key}`;
  }

  /**
   * A time-limited URL for a PRIVATE object.
   *
   * Private objects live in a bucket with no public hostname, so this is the
   * only way to read one — and it expires. Fifteen minutes is enough to open
   * an image in an admin screen and short enough that a URL copied out of a
   * browser's history is useless by the time anybody finds it.
   */
  async signedUrl(key: string, expiresInSeconds = 900): Promise<string> {
    return getSignedUrl(
      this.getClient(),
      new GetObjectCommand({ Bucket: this.bucketFor('private'), Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }
}
