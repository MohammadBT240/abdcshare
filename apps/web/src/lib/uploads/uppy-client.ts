'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import { bffApi } from '@/lib/bff/client';

/** Soft threshold — above this, use R2 multipart. */
export const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;

interface PresignedUpload {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
}

interface MultipartCreateResult {
  storageKey: string;
  uploadId: string;
}

interface MultipartSignPartsResult {
  parts: Array<{ partNumber: number; url: string }>;
}

export type UploadEndpointKind = 'submission' | 'document' | 'message';

export type FileUploadStatus = 'queued' | 'uploading' | 'failed' | 'done';

export interface UppyFileState {
  id: string;
  name: string;
  percent: number;
  status: FileUploadStatus;
  error?: string;
}

export function uploadBasePath(kind: UploadEndpointKind, parentId: string): string {
  switch (kind) {
    case 'submission':
      return `/api/submissions/${parentId}/files`;
    case 'document':
      return `/api/documents/${parentId}/files`;
    case 'message':
      return `/api/messages/${parentId}/attachments`;
  }
}

export interface UploadBytesProgress {
  percent: number;
  bytesUploaded: number;
  bytesTotal: number;
}

export interface CreateUploadUppyOptions {
  kind: UploadEndpointKind;
  parentId: string;
  /** Optional: mark uploaded files as replacements for a Returned submission file. */
  replacesFileId?: string;
  onProgress?: (percent: number) => void;
  /** Aggregate bytes progress (for bandwidth / transferred-size UI). */
  onBytesProgress?: (progress: UploadBytesProgress) => void;
  onFileProgress?: (fileId: string, percent: number, fileName: string) => void;
}

function configureAwsS3(uppy: Uppy, options: CreateUploadUppyOptions): void {
  const base = uploadBasePath(options.kind, options.parentId);
  /** Prefetch window of part URLs to cut API round-trips on slow links. */
  const partUrlCache = new Map<string, Map<number, string>>();
  const PART_PREFETCH = 6;

  uppy.use(AwsS3, {
    id: 'AwsS3',
    // 2 concurrent uploads: fills bandwidth without thrashing slow / lossy links.
    limit: 2,
    retryDelays: [0, 1000, 3000, 5000],
    shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD_BYTES,
    // 8 MiB parts: fewer requests than tiny chunks, still recoverable on failure.
    getChunkSize: () => 8 * 1024 * 1024,

    async getUploadParameters(file) {
      const contentType = file.type || 'application/octet-stream';
      const replacesFileId = options.replacesFileId;
      const presigned = await bffApi<PresignedUpload>(`${base}/presign`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          ...(replacesFileId ? { replacesFileId } : {}),
        }),
      });
      file.meta = {
        ...file.meta,
        storageKey: presigned.storageKey,
        contentType,
        replacesFileId,
      };
      return {
        method: 'PUT',
        url: presigned.uploadUrl,
        headers: presigned.headers,
      };
    },

    async createMultipartUpload(file) {
      const contentType = file.type || 'application/octet-stream';
      const replacesFileId = options.replacesFileId;
      const created = await bffApi<MultipartCreateResult>(`${base}/multipart`, {
        method: 'POST',
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          sizeBytes: file.size ?? 0,
          ...(replacesFileId ? { replacesFileId } : {}),
        }),
      });
      file.meta = {
        ...file.meta,
        storageKey: created.storageKey,
        contentType,
        replacesFileId,
      };
      partUrlCache.set(`${created.uploadId}:${created.storageKey}`, new Map());
      return { uploadId: created.uploadId, key: created.storageKey };
    },

    async signPart(_file, { uploadId, key, partNumber }) {
      const cacheKey = `${uploadId}:${key}`;
      let cache = partUrlCache.get(cacheKey);
      if (!cache) {
        cache = new Map();
        partUrlCache.set(cacheKey, cache);
      }

      const cached = cache.get(partNumber);
      if (cached) {
        cache.delete(partNumber);
        return { method: 'PUT' as const, url: cached };
      }

      const partNumbers: number[] = [];
      for (let n = partNumber; n < partNumber + PART_PREFETCH; n += 1) {
        if (!cache.has(n)) partNumbers.push(n);
      }

      const signed = await bffApi<MultipartSignPartsResult>(
        `${base}/multipart/${encodeURIComponent(uploadId)}/parts`,
        {
          method: 'POST',
          body: JSON.stringify({
            storageKey: key,
            partNumbers,
          }),
        },
      );

      for (const part of signed.parts) {
        if (part?.url) cache.set(part.partNumber, part.url);
      }

      const url = cache.get(partNumber);
      if (!url) throw new Error(`Failed to sign part ${partNumber}`);
      cache.delete(partNumber);
      return { method: 'PUT' as const, url };
    },

    async listParts() {
      return [];
    },

    async abortMultipartUpload(_file, { uploadId, key }) {
      if (!uploadId || !key) return;
      partUrlCache.delete(`${uploadId}:${key}`);
      await bffApi(`${base}/multipart/${encodeURIComponent(uploadId)}/abort`, {
        method: 'POST',
        body: JSON.stringify({ storageKey: key }),
      });
    },

    async completeMultipartUpload(file, { uploadId, key, parts }) {
      if (!uploadId || !key) throw new Error('Missing multipart upload id or key');
      partUrlCache.delete(`${uploadId}:${key}`);
      const replacesFileId =
        (file.meta?.replacesFileId as string | undefined) ?? options.replacesFileId;
      await bffApi(`${base}/multipart/${encodeURIComponent(uploadId)}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          storageKey: key,
          fileName: file.name,
          mimeType: file.type || undefined,
          sizeBytes: file.size ?? 0,
          parts: parts.map((p) => ({
            partNumber: p.PartNumber!,
            etag: p.ETag!,
          })),
          ...(replacesFileId ? { replacesFileId } : {}),
        }),
      });
      return {};
    },
  });
}

export function createUploadUppy(options: CreateUploadUppyOptions): Uppy {
  const uppy = new Uppy({
    autoProceed: false,
    allowMultipleUploadBatches: true,
    restrictions: { maxNumberOfFiles: 50 },
  });

  configureAwsS3(uppy, options);

  uppy.on('upload-progress', (file, progress) => {
    if (!file) return;
    const bytesTotal = progress.bytesTotal || file.size || 0;
    const percent =
      bytesTotal > 0 ? Math.min(100, Math.round((progress.bytesUploaded / bytesTotal) * 100)) : 0;
    options.onFileProgress?.(file.id, percent, file.name);
    const files = uppy.getFiles();
    let uploaded = 0;
    let total = 0;
    for (const f of files) {
      total += f.size || 0;
      uploaded += f.progress?.bytesUploaded || 0;
    }
    if (total > 0) {
      const aggregatePercent = Math.min(100, Math.round((uploaded / total) * 100));
      options.onProgress?.(aggregatePercent);
      options.onBytesProgress?.({
        percent: aggregatePercent,
        bytesUploaded: uploaded,
        bytesTotal: total,
      });
    }
  });

  return uppy;
}

export async function confirmSimpleUpload(
  kind: UploadEndpointKind,
  parentId: string,
  file: File,
  storageKey: string,
  replacesFileId?: string,
): Promise<void> {
  const base = uploadBasePath(kind, parentId);
  await bffApi(base, {
    method: 'POST',
    body: JSON.stringify({
      storageKey,
      fileName: file.name,
      mimeType: file.type || undefined,
      sizeBytes: file.size,
      ...(replacesFileId ? { replacesFileId } : {}),
    }),
  });
}

async function confirmPendingSimpleUploads(
  uppy: Uppy,
  options: CreateUploadUppyOptions,
): Promise<void> {
  for (const file of uppy.getFiles()) {
    if (file.error) continue;
    const usedMultipart = (file.size ?? 0) > MULTIPART_THRESHOLD_BYTES;
    const storageKey = file.meta?.storageKey as string | undefined;
    const replacesFileId =
      (file.meta?.replacesFileId as string | undefined) ?? options.replacesFileId;
    if (usedMultipart || !storageKey) continue;
    if (file.meta?.confirmed) continue;
    const blob = file.data;
    const asFile =
      blob instanceof File
        ? blob
        : new File([blob as Blob], file.name, { type: file.type });
    await confirmSimpleUpload(
      options.kind,
      options.parentId,
      asFile,
      storageKey,
      replacesFileId,
    );
    file.meta = { ...file.meta, confirmed: true };
  }
}

/** One-shot upload helper for discussions / documents. */
export async function uploadFilesWithUppy(
  options: CreateUploadUppyOptions,
  files: File[],
): Promise<void> {
  if (files.length === 0) return;
  const uppy = createUploadUppy(options);
  try {
    for (const file of files) {
      uppy.addFile({
        name: file.name,
        type: file.type,
        data: file,
        source: 'Local',
      });
    }
    const result = await uppy.upload();
    if (result?.failed?.length) {
      const err = result.failed[0]?.error;
      throw new Error(typeof err === 'string' && err ? err : 'Upload failed');
    }
    await confirmPendingSimpleUploads(uppy, options);
  } finally {
    uppy.cancelAll();
    uppy.destroy();
  }
}

function snapshotStates(uppy: Uppy): UppyFileState[] {
  return uppy.getFiles().map((f) => {
    const bytesTotal = f.progress?.bytesTotal || f.size || 0;
    const bytesUploaded = f.progress?.bytesUploaded || 0;
    const percent =
      bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0;
    let status: FileUploadStatus = 'queued';
    if (f.error) status = 'failed';
    else if (f.progress?.uploadComplete) status = 'done';
    else if (f.progress?.uploadStarted) status = 'uploading';
    return {
      id: f.id,
      name: f.name,
      percent: status === 'done' ? 100 : percent,
      status,
      error: typeof f.error === 'string' ? f.error : undefined,
    };
  });
}

export interface UseUppyUploaderOptions {
  kind: UploadEndpointKind;
  /** When null, the uploader is idle (no Uppy instance). */
  parentId: string | null;
  replacesFileId?: string;
}

/**
 * Long-lived Uppy instance for dialogs that need per-file progress + retry.
 * Create the draft first, then set parentId; call addFiles + upload.
 */
export function useUppyUploader(options: UseUppyUploaderOptions) {
  const uppyRef = useRef<Uppy | null>(null);
  const [fileStates, setFileStates] = useState<UppyFileState[]>([]);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sync = useCallback(() => {
    if (!uppyRef.current) {
      setFileStates([]);
      return;
    }
    setFileStates(snapshotStates(uppyRef.current));
  }, []);

  const destroy = useCallback(() => {
    if (uppyRef.current) {
      uppyRef.current.cancelAll();
      uppyRef.current.destroy();
      uppyRef.current = null;
    }
    setFileStates([]);
  }, []);

  const ensureUppy = useCallback((): Uppy => {
    const parentId = optionsRef.current.parentId;
    if (!parentId) throw new Error('Upload parent id is not set');
    if (uppyRef.current) return uppyRef.current;

    const uppy = createUploadUppy({
      kind: optionsRef.current.kind,
      parentId,
      replacesFileId: optionsRef.current.replacesFileId,
    });

    uppy.on('upload-progress', () => sync());
    uppy.on('upload-success', () => sync());
    uppy.on('upload-error', () => sync());
    uppy.on('file-added', () => sync());
    uppy.on('file-removed', () => sync());

    uppyRef.current = uppy;
    return uppy;
  }, [sync]);

  // Tear down when parentId clears or component unmounts.
  useEffect(() => {
    if (!options.parentId) destroy();
    return () => {
      // only destroy on unmount / parent clear — keep instance across retries
    };
  }, [options.parentId, destroy]);

  useEffect(() => () => destroy(), [destroy]);

  const addFiles = useCallback(
    (files: File[]) => {
      const uppy = ensureUppy();
      for (const file of files) {
        try {
          uppy.addFile({
            name: file.name,
            type: file.type,
            data: file,
            source: 'Local',
          });
        } catch {
          // duplicate name etc.
        }
      }
      sync();
    },
    [ensureUppy, sync],
  );

  const upload = useCallback(async (): Promise<{ allDone: boolean }> => {
    const uppy = ensureUppy();
    sync();
    const result = await uppy.upload();
    // Confirm simple uploads for successful files.
    await confirmPendingSimpleUploads(uppy, {
      kind: optionsRef.current.kind,
      parentId: optionsRef.current.parentId!,
      replacesFileId: optionsRef.current.replacesFileId,
    });
    sync();
    const failed = result?.failed?.length ?? 0;
    const files = uppy.getFiles();
    const allDone = files.length > 0 && failed === 0 && files.every((f) => !f.error);
    return { allDone };
  }, [ensureUppy, sync]);

  const retryFile = useCallback(
    async (fileId: string) => {
      const uppy = ensureUppy();
      const file = uppy.getFile(fileId);
      if (!file) return;
      // Clear error so Uppy will retry.
      uppy.setFileState(fileId, { error: null, progress: { ...file.progress, uploadComplete: false } });
      sync();
      await uppy.retryUpload(fileId);
      await confirmPendingSimpleUploads(uppy, {
        kind: optionsRef.current.kind,
        parentId: optionsRef.current.parentId!,
        replacesFileId: optionsRef.current.replacesFileId,
      });
      sync();
    },
    [ensureUppy, sync],
  );

  const removeFile = useCallback(
    (fileId: string) => {
      const uppy = uppyRef.current;
      if (!uppy) return;
      try {
        uppy.removeFile(fileId);
      } catch {
        // already gone
      }
      sync();
    },
    [sync],
  );

  const removeFileByName = useCallback(
    (name: string) => {
      const uppy = uppyRef.current;
      if (!uppy) return;
      for (const f of uppy.getFiles()) {
        if (f.name === name) {
          try {
            uppy.removeFile(f.id);
          } catch {
            // ignore
          }
        }
      }
      sync();
    },
    [sync],
  );

  const retryAllFailed = useCallback(async (): Promise<{ allDone: boolean }> => {
    const uppy = ensureUppy();
    const failed = uppy.getFiles().filter((f) => f.error);
    for (const file of failed) {
      uppy.setFileState(file.id, {
        error: null,
        progress: { ...file.progress, uploadComplete: false },
      });
    }
    sync();
    if (failed.length > 0) {
      await uppy.retryAll();
      await confirmPendingSimpleUploads(uppy, {
        kind: optionsRef.current.kind,
        parentId: optionsRef.current.parentId!,
        replacesFileId: optionsRef.current.replacesFileId,
      });
    }
    sync();
    const files = uppy.getFiles();
    const allDone = files.length > 0 && files.every((f) => !f.error && f.progress?.uploadComplete);
    return { allDone };
  }, [ensureUppy, sync]);

  const cancelAll = useCallback(() => {
    uppyRef.current?.cancelAll();
    sync();
  }, [sync]);

  const allDone =
    fileStates.length > 0 && fileStates.every((f) => f.status === 'done');
  const hasFailed = fileStates.some((f) => f.status === 'failed');
  const isUploading = fileStates.some((f) => f.status === 'uploading');

  return {
    fileStates,
    addFiles,
    upload,
    retryFile,
    retryAllFailed,
    removeFile,
    removeFileByName,
    cancelAll,
    destroy,
    allDone,
    hasFailed,
    isUploading,
  };
}

/** Tracks browser online/offline for upload retry UX. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}
