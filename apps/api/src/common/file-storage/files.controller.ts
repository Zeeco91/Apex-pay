import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import {
  LocalDiskStorageProvider,
  UPLOADS_ROOT,
} from './local-disk-storage.provider';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Serves files stored by LocalDiskStorageProvider — dev-only counterpart to whatever a real
 * S3/R2 provider would serve directly via its own presigned URLs. Every request must carry a
 * valid, unexpired HMAC token (issued by getSignedUrl, only after the caller was already
 * authorized to view this specific file — see TransactionsService.getProofUrl).
 */
@Controller('files')
export class FilesController {
  constructor(private readonly storage: LocalDiskStorageProvider) {}

  @Get(':folder/:filename')
  serve(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Query('expires') expires: string,
    @Query('token') token: string,
    @Res() res: Response,
  ): void {
    if (
      folder.includes('..') ||
      filename.includes('..') ||
      filename.includes('/') ||
      folder.includes('/')
    ) {
      throw new NotFoundException();
    }

    const key = `${folder}/${filename}`;
    if (
      !expires ||
      !token ||
      !this.storage.verifyToken(key, Number(expires), token)
    ) {
      throw new NotFoundException();
    }

    const absolutePath = join(UPLOADS_ROOT, folder, filename);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException();
    }

    const contentType =
      CONTENT_TYPES[extname(filename).toLowerCase()] ??
      'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.sendFile(absolutePath);
  }
}
