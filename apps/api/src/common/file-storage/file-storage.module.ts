import { Module } from '@nestjs/common';
import { FILE_STORAGE_PROVIDER } from './file-storage-provider.interface';
import { LocalDiskStorageProvider } from './local-disk-storage.provider';
import { FilesController } from './files.controller';

@Module({
  controllers: [FilesController],
  providers: [
    LocalDiskStorageProvider,
    { provide: FILE_STORAGE_PROVIDER, useExisting: LocalDiskStorageProvider },
  ],
  exports: [FILE_STORAGE_PROVIDER],
})
export class FileStorageModule {}
