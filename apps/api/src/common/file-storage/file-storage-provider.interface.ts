export const FILE_STORAGE_PROVIDER = Symbol('FILE_STORAGE_PROVIDER');

export interface SavedFile {
  key: string;
}

export interface FileStorageProvider {
  save(params: {
    buffer: Buffer;
    extension: string;
    folder: string;
  }): Promise<SavedFile>;
  getSignedUrl(key: string): string;
}
