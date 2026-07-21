import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { PresignedUpload, PresignUploadInput, StoragePort } from './storage.port';

/** Filename → safe object-key segment. */
function slugify(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80);
  const ext = dot > 0 ? name.slice(dot).replace(/[^a-zA-Z0-9.]+/g, '').slice(0, 12) : '';
  return `${base || 'file'}${ext}`;
}

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

  presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    const storageKey = `${input.keyPrefix.replace(/\/+$/, '')}/${randomUUID()}-${slugify(input.fileName)}`;
    const expiresIn = this.config.get<number>('STORAGE_UPLOAD_TTL', 900);
    return Promise.resolve({
      storageKey,
      uploadUrl: `${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}`,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresIn,
    });
  }

  presignDownload(storageKey: string, downloadName?: string): Promise<string> {
    const q = downloadName ? `?download=${encodeURIComponent(downloadName)}` : '';
    return Promise.resolve(`${this.base()}/api/storage/local/${encodeURIComponent(storageKey)}${q}`);
  }
}
