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

/**
 * Abstraction over object storage. The domain never talks to R2/S3 directly —
 * it asks for a presigned upload, persists the returned `storageKey`, then later
 * asks for a presigned download. Swapping `local` ↔ `r2` changes only the adapter.
 */
export interface StoragePort {
  presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
  presignDownload(storageKey: string, downloadName?: string): Promise<string>;
}
