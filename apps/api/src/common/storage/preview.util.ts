import { FilePreviewStatus } from '@abdcshare/shared';

const OFFICE_MIME = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-outlook',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
]);

/** Document extensions that may preview natively (PDF) or via converted PDF. */
const OFFICE_EXT =
  /\.(docx?|pptx?|xlsx?|odt|ods|odp|rtf|msg|pages|numbers|key)$/i;

const DOCUMENT_EXT =
  /\.(pdf|docx?|pptx?|xlsx?|odt|ods|odp|rtf|txt|csv|md|json|xml)$/i;

/** Types that must never render in an iframe / img (scriptable or installers). */
const BLOCKED_EXT =
  /\.(exe|dmg|pkg|msi|bat|cmd|com|scr|ps1|sh|bash|zsh|html?|htm|xhtml|svg|js|mjs|cjs|wasm|apk|app|deb|rpm|dll|so|dylib)$/i;

const BLOCKED_MIME = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'application/javascript',
  'text/javascript',
  'application/x-msdownload',
  'application/x-apple-diskimage',
  'application/vnd.microsoft.portable-executable',
]);

export function isOfficeMime(mimeType?: string | null, fileName?: string): boolean {
  if (mimeType && OFFICE_MIME.has(mimeType)) return true;
  if (fileName && OFFICE_EXT.test(fileName)) return true;
  return false;
}

export function isBlockedPreviewType(mimeType?: string | null, fileName?: string): boolean {
  if (mimeType && BLOCKED_MIME.has(mimeType)) return true;
  if (fileName && BLOCKED_EXT.test(fileName)) return true;
  return false;
}

/** Safe browser-native preview (no Office conversion required). */
export function isNativePreviewable(mimeType?: string | null, fileName?: string): boolean {
  if (isBlockedPreviewType(mimeType, fileName)) return false;
  if (!mimeType) {
    return Boolean(fileName && /\.(pdf|png|jpe?g|gif|webp|txt|csv|json|xml|md)$/i.test(fileName));
  }
  if (mimeType === 'application/pdf') return true;
  if (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') return true;
  if (mimeType.startsWith('text/') && mimeType !== 'text/html') return true;
  if (mimeType.startsWith('video/')) return true;
  if (mimeType === 'application/json' || mimeType === 'application/xml') return true;
  return false;
}

/**
 * Types we allow opening in the in-app viewer (native, converted PDF, or zip listing).
 * Includes all common document extensions (Office → converted PDF when Ready).
 */
export function isPreviewAllowlisted(mimeType?: string | null, fileName?: string): boolean {
  if (isBlockedPreviewType(mimeType, fileName)) return false;
  if (isZipMime(mimeType, fileName)) return true;
  if (isOfficeMime(mimeType, fileName)) return true;
  if (isNativePreviewable(mimeType, fileName)) return true;
  if (fileName && DOCUMENT_EXT.test(fileName)) return true;
  return false;
}

export function isZipMime(mimeType?: string | null, fileName?: string): boolean {
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/x-zip-compressed' ||
    mimeType === 'application/octet-stream'
  ) {
    if (mimeType !== 'application/octet-stream') return true;
  }
  return Boolean(fileName?.toLowerCase().endsWith('.zip'));
}

/** Initial preview status when a file row is created. */
export function initialPreviewStatus(
  mimeType?: string | null,
  fileName?: string,
): FilePreviewStatus {
  if (isOfficeMime(mimeType, fileName)) return FilePreviewStatus.Pending;
  if (isNativePreviewable(mimeType, fileName)) return FilePreviewStatus.Ready;
  return FilePreviewStatus.None;
}
