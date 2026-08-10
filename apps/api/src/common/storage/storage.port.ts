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

export interface MultipartCreateResult {
  storageKey: string;
  uploadId: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export type PresignDownloadOptions = {
  /** Defaults to `attachment` when `fileName` is set; omit for no Content-Disposition override. */
  disposition?: 'inline' | 'attachment';
};

/**
 * Abstraction over object storage. The domain never talks to R2/S3 directly —
 * it asks for a presigned upload, persists the returned `storageKey`, then later
 * asks for a presigned download. Swapping `local` ↔ `r2` changes only the adapter.
 *
 * Prefer {@link StoragePort.upload} when the browser cannot PUT to the bucket
 * (e.g. R2 CORS not configured) — the API writes the bytes server-side.
 *
 * For large files, use the multipart lifecycle (create → sign parts → complete/abort).
 */
export interface StoragePort {
  presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
  /** Server-side write — returns the storage key to persist. */
  upload(input: DirectUploadInput): Promise<{ storageKey: string }>;
  presignDownload(
    storageKey: string,
    downloadName?: string,
    options?: PresignDownloadOptions,
  ): Promise<string>;

  createMultipart(input: PresignUploadInput): Promise<MultipartCreateResult>;
  /** Presigned URL for a single UploadPart PUT. */
  presignPart(storageKey: string, uploadId: string, partNumber: number): Promise<{ url: string }>;
  completeMultipart(
    storageKey: string,
    uploadId: string,
    parts: MultipartPart[],
  ): Promise<void>;
  abortMultipart(storageKey: string, uploadId: string): Promise<void>;
  /** Object size after upload, or null if missing. */
  head(storageKey: string): Promise<{ sizeBytes: number } | null>;
  /** Server-side read of object bytes (zip listing, preview conversion). */
  getObject(storageKey: string): Promise<Buffer>;
  /** Inclusive byte range read (zip central directory / single-entry extract). */
  getObjectRange(storageKey: string, start: number, endInclusive: number): Promise<Buffer>;
}
