/** Shared file validation for avatar + generic file upload. */

export function validateFileMime(file: File, allowed: Set<string>): string | null {
  if (!allowed.has(file.type)) {
    return `Unsupported file type (${file.type || 'unknown'})`;
  }
  return null;
}

export function validateFileSize(file: File, maxBytes: number): string | null {
  if (file.size > maxBytes) {
    const mb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return `File must be ${mb} MB or smaller`;
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

/** Default for documents / company profiles / future working papers. */
export const DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;

export const COMPANY_PROFILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
