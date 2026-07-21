import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Env } from '../../config/env.validation';
import type {
  FileStorageProvider,
  SavedFile,
} from './file-storage-provider.interface';

const SIGNED_URL_TTL_SECONDS = 5 * 60;

export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

/**
 * Stand-in until a real provider (S3/R2, plan §1) is wired up. Stores files on local disk and
 * issues HMAC-signed, short-lived URLs served back through FilesController — nothing under
 * `uploads/` is ever served without a valid, unexpired token.
 *
 * NOT production-ready: getSignedUrl() below hardcodes `localhost`, so generated links are
 * unreachable for real users, and anything saved here is lost on every redeploy (no persistent
 * volume). This previously threw on construction when NODE_ENV=production, but every provider
 * in this module (this one, SmsModule's ConsoleSmsProvider) gets eagerly instantiated at boot
 * regardless of whether file upload is ever used, so that guard crashed the whole app rather
 * than only the KYC/proof-of-payment upload paths that actually need a real provider. Removed
 * so registration/login (which don't touch file storage) can run — file upload remains broken
 * in production until a real FileStorageProvider is wired in.
 */
@Injectable()
export class LocalDiskStorageProvider implements FileStorageProvider {
  private readonly logger = new Logger(LocalDiskStorageProvider.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async save(params: {
    buffer: Buffer;
    extension: string;
    folder: string;
  }): Promise<SavedFile> {
    const dir = join(UPLOADS_ROOT, params.folder);
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${params.extension}`;
    await writeFile(join(dir, filename), params.buffer);
    const key = `${params.folder}/${filename}`;
    this.logger.warn(
      `[DEV ONLY — local disk, not durable/secure storage] Stored file at ${key}`,
    );
    return { key };
  }

  getSignedUrl(key: string): string {
    const expires = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    const token = this.sign(key, expires);
    const port = this.config.get('PORT', { infer: true });
    return `http://localhost:${port}/api/v1/files/${key}?expires=${expires}&token=${token}`;
  }

  verifyToken(key: string, expires: number, token: string): boolean {
    if (!Number.isFinite(expires) || Date.now() > expires) return false;
    const expected = Buffer.from(this.sign(key, expires));
    const candidate = Buffer.from(token);
    if (expected.length !== candidate.length) return false;
    return timingSafeEqual(expected, candidate);
  }

  private sign(key: string, expires: number): string {
    const secret = this.config.get('FILE_ACCESS_HMAC_SECRET', { infer: true });
    return createHmac('sha256', secret)
      .update(`${key}:${expires}`)
      .digest('hex');
  }
}
