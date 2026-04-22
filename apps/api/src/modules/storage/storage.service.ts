import { Injectable, NotImplementedException } from '@nestjs/common';

import type { StorageUploadInput, StorageUploadResult } from './storage.types';

@Injectable()
export class StorageService {
  async upload(input: StorageUploadInput): Promise<StorageUploadResult> {
    void input;

    throw new NotImplementedException(
      'Storage integration is intentionally deferred until Milestone 3.',
    );
  }

  async getSignedUrl(key: string): Promise<string> {
    void key;

    throw new NotImplementedException(
      'Signed URL generation is intentionally deferred until Milestone 3.',
    );
  }

  async delete(key: string): Promise<void> {
    void key;

    throw new NotImplementedException(
      'Object deletion is intentionally deferred until Milestone 3.',
    );
  }
}
