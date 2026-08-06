import { UPLOAD_MAX_BYTES } from '../../common/storage/upload.constants';

/**
 * Working papers, final reports, and other engagement documents.
 * Same hard cap as submissions / discussions (mirrors web UPLOAD_MAX_BYTES).
 */
export const DOCUMENT_MAX_BYTES = UPLOAD_MAX_BYTES;

export function formatDocumentMaxBytesLabel(maxBytes = DOCUMENT_MAX_BYTES): string {
  if (maxBytes >= 1024 * 1024 * 1024) {
    const gb = Math.round((maxBytes / (1024 * 1024 * 1024)) * 10) / 10;
    return `${gb} GB`;
  }
  return `${Math.floor(maxBytes / (1024 * 1024))} MB`;
}
