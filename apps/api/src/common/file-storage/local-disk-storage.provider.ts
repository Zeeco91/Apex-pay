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
 * Local-disk fallback, selected by FileStorageModule only when R2 credentials aren't
 * configured (local dev). Stores files on local disk and issues HMAC-signed, short-lived URLs
 * served back through FilesController — nothing under `uploads/` is ever served without a
 * valid, unexpired token.
 *
 * NOT fit for production use: getSignedUrl() below resolves a real, browser-reachable base URL
 * (PUBLIC_API_URL, or Railway's auto-injected domain, or localhost for local dev — see
 * publicBaseUrl()), but anything saved here is still lost on every redeploy (no persistent
 * volume) — see R2StorageProvider for the real production provider. This previously threw on
 * construction when NODE_ENV=production, but every provider in this module (this one,
 * SmsModule's ConsoleSmsProvider) gets eagerly instantiated at boot regardless of whether file
 * upload is ever used, so that guard crashed the whole app rather than only the
 * proof-of-payment upload paths that actually need a real provider. Removed so
 * registration/login (which don't touch file storage) can run.
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

  // Matches the async FileStorageProvider interface (R2StorageProvider's presigner is
  // genuinely async) even though this implementation has nothing to await.
  // eslint-disable-next-line @typescript-eslint/require-await
  async getSignedUrl(key: string): Promise<string> {
    const expires = Date.now() + SIGNED_URL_TTL_SECONDS * 1000;
    const token = this.sign(key, expires);
    return `${this.publicBaseUrl()}/api/v1/files/${key}?expires=${expires}&token=${token}`;
  }

  private publicBaseUrl(): string {
    const configured = this.config.get('PUBLIC_API_URL', { infer: true });
    if (configured) return configured.replace(/\/$/, '');

    // Railway injects this for any service with a public domain — a zero-config default for
    // our actual deployment target, without hardcoding a specific domain here.
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    if (railwayDomain) return `https://${railwayDomain}`;

    const port = this.config.get('PORT', { infer: true });
    return `http://localhost:${port}`;
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
