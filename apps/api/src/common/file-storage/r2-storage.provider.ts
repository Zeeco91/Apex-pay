import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../../config/env.validation';
import type {
  FileStorageProvider,
  SavedFile,
} from './file-storage-provider.interface';

const SIGNED_URL_TTL_SECONDS = 5 * 60;

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Cloudflare R2 (S3-compatible) storage — the real production provider, selected by
 * FileStorageModule whenever all four R2_* env vars are configured. Unlike
 * LocalDiskStorageProvider, files live in a durable object store rather than the container's
 * own disk, so they survive every redeploy. getSignedUrl() returns a presigned URL that R2
 * itself validates — no need for our own HMAC/FilesController machinery, which exists only for
 * the local-disk fallback.
 *
 * Constructed with empty-string fallbacks rather than throwing on missing config — like every
 * provider in FileStorageModule, this gets eagerly instantiated at boot even when
 * LocalDiskStorageProvider is the one actually selected (e.g. local dev with no R2 credentials
 * set), so a hard failure here would crash the whole app over a feature that isn't even in use.
 */
@Injectable()
export class R2StorageProvider implements FileStorageProvider {
  private readonly logger = new Logger(R2StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const accountId = this.config.get('R2_ACCOUNT_ID', { infer: true }) ?? '';
    this.bucket = this.config.get('R2_BUCKET_NAME', { infer: true }) ?? '';
    this.client = new S3Client({
      region: 'auto',
      endpoint: accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : undefined,
      credentials: {
        accessKeyId: this.config.get('R2_ACCESS_KEY_ID', { infer: true }) ?? '',
        secretAccessKey:
          this.config.get('R2_SECRET_ACCESS_KEY', { infer: true }) ?? '',
      },
    });
  }

  async save(params: {
    buffer: Buffer;
    extension: string;
    folder: string;
  }): Promise<SavedFile> {
    const key = `${params.folder}/${randomUUID()}.${params.extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType:
          CONTENT_TYPES[params.extension] ?? 'application/octet-stream',
      }),
    );
    this.logger.log(`Stored file at ${key}`);
    return { key };
  }

  getSignedUrl(key: string): Promise<string> {
    return presign(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
  }
}
