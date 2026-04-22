export interface StorageUploadInput {
  buffer: Buffer;
  key: string;
  mimeType: string;
}

export interface StorageUploadResult {
  key: string;
}
