export interface StorageUploadInput {
  buffer: Buffer;
  key: string;
  mimeType: string;
}

export interface StorageUploadResult {
  key: string;
}

export interface StorageSignedUrlResult {
  expiresInSeconds: number;
  url: string;
}
