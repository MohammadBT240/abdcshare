/** Shared file validation for avatar + generic file upload. */

export function validateFileMime(file: File, allowed: Set<string>): string | null {
  if (!allowed.has(file.type)) {
    return `Unsupported file type (${file.type || 'unknown'})`;
  }
  return null;
}

export function formatMaxBytesLabel(maxBytes: number): string {
  if (maxBytes >= 1024 * 1024 * 1024) {
    const gb = Math.round((maxBytes / (1024 * 1024 * 1024)) * 10) / 10;
    return `${gb} GB`;
  }
  const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
  return `${mb} MB`;
}

export function validateFileSize(file: File, maxBytes: number): string | null {
  if (file.size > maxBytes) {
    return `File must be ${formatMaxBytesLabel(maxBytes)} or smaller`;
  }
  return null;
}

export function validateFile(
  file: File,
  opts: { allowedTypes: Set<string>; maxBytes: number },
): string | null {
  return validateFileMime(file, opts.allowedTypes) ?? validateFileSize(file, opts.maxBytes);
}

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Default for company profiles / planning docs / request briefs. */
export const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;

/** Client submissions, discussions, working papers, final reports (matches API UPLOAD_MAX_BYTES). */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024 * 1024;

export const COMPANY_PROFILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const ZIP_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
]);

/** Accept string for generic attachments (submissions, discussions, documents). Includes zip. */
export const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.gif,.webp,.zip,.mp4,.mov,' +
  'application/pdf,' +
  'application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-powerpoint,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'application/vnd.ms-excel,' +
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'text/plain,text/csv,' +
  'image/*,video/*,' +
  'application/zip,application/x-zip-compressed';
