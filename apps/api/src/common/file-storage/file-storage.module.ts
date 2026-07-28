import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';
import { FILE_STORAGE_PROVIDER } from './file-storage-provider.interface';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { R2StorageProvider } from './r2-storage.provider';
import { FilesController } from './files.controller';

const R2_REQUIRED_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
] as const;

@Module({
  controllers: [FilesController],
  providers: [
    LocalDiskStorageProvider,
    R2StorageProvider,
    {
      provide: FILE_STORAGE_PROVIDER,
      // R2 only if ALL four vars are set — a partially-configured R2 would otherwise silently
      // win over the (fully functional for dev) local-disk fallback and fail at upload time
      // instead of falling back cleanly.
      useFactory: (
        config: ConfigService<Env, true>,
        r2: R2StorageProvider,
        local: LocalDiskStorageProvider,
      ) => {
        const hasFullR2Config = R2_REQUIRED_ENV_KEYS.every((key) =>
          Boolean(config.get(key, { infer: true })),
        );
        return hasFullR2Config ? r2 : local;
      },
      inject: [ConfigService, R2StorageProvider, LocalDiskStorageProvider],
    },
  ],
  exports: [FILE_STORAGE_PROVIDER],
})
export class FileStorageModule {}
