import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { buildStorageKey } from './storage-key.util';
import type { DirectUploadInput, PresignedUpload, PresignUploadInput, StoragePort } from './storage.port';

/**
 * Dependency-free dev storage. Generates stable keys and dev upload/download URLs
 * pointing at the API's `/api/storage/local` endpoints. **Not for production** —
 * production swaps in the R2 (S3 SDK) adapter, keying off `STORAGE_DRIVER=r2`.
 */
export class LocalStorageAdapter implements StoragePort {
  constructor(private readonly config: ConfigService) {}

  private base(): string {
    return this.config.get<string>('STORAGE_PUBLIC_BASE_URL', 'http://localhost:4000').replace(/\/+$/, '');
  }

  private rootDir(): string {
    return this.config.get<string>('LOCAL_STORAGE_DIR', './storage');
  }

  presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName);
    const expiresIn = this.config.get<number>('STORAGE_UPLOAD_TTL', 900);
    return Promise.resolve({
      storageKey,
      uploadUrl: `${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}`,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresIn,
    });
  }

  async upload(input: DirectUploadInput): Promise<{ storageKey: string }> {
    const storageKey = buildStorageKey(input.keyPrefix, input.fileName);
    const filePath = path.join(this.rootDir(), storageKey);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, input.body);
    return { storageKey };
  }

  presignDownload(storageKey: string, downloadName?: string): Promise<string> {
    const q = downloadName ? `?download=${encodeURIComponent(downloadName)}` : '';
    return Promise.resolve(`${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}${q}`);
  }
}
