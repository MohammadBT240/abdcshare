/** Injection token for the active storage adapter. */
export const STORAGE = Symbol('STORAGE');

export interface PresignUploadInput {
  /** Logical folder, e.g. `documents/<engagementId>`. */
  keyPrefix: string;
  fileName: string;
  contentType: string;
}

export interface PresignedUpload {
  /** The stable object key to persist on the file row. */
  storageKey: string;
  /** URL the client PUTs the bytes to (presigned for R2; a dev endpoint for local). */
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresIn: number;
}

export interface DirectUploadInput extends PresignUploadInput {
  body: Buffer;
}

/**
 * Abstraction over object storage. The domain never talks to R2/S3 directly —
 * it asks for a presigned upload, persists the returned `storageKey`, then later
 * asks for a presigned download. Swapping `local` ↔ `r2` changes only the adapter.
 *
 * Prefer {@link StoragePort.upload} when the browser cannot PUT to the bucket
 * (e.g. R2 CORS not configured) — the API writes the bytes server-side.
 */
export interface StoragePort {
  presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
  /** Server-side write — returns the storage key to persist. */
  upload(input: DirectUploadInput): Promise<{ storageKey: string }>;
  presignDownload(storageKey: string, downloadName?: string): Promise<string>;
}
