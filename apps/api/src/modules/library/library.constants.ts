/** Upload limits for library files (mirrors company profiles; >50 MB goes multipart). */
export const LIBRARY_MAX_BYTES = 100 * 1024 * 1024;

/** Storage folder; keys look like `[objectPrefix/]library/<itemId>/<uuid>-<slug>`. */
export const LIBRARY_KEY_PREFIX = 'library';

/** Allowed MIME → file-type bucket used by the `fileType` filter. */
export const LIBRARY_MIME_TYPES: Record<string, LibraryFileType> = {
  'application/pdf': 'pdf',
  'application/msword': 'word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'word',
  'application/vnd.ms-excel': 'excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'excel',
  'application/vnd.ms-powerpoint': 'powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'powerpoint',
  'image/png': 'image',
  'image/jpeg': 'image',
  'text/plain': 'text',
  'text/csv': 'text',
};

/** Extension must agree with an allowed type (defence against renamed executables). */
export const LIBRARY_FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|txt|csv)$/i;

export const LIBRARY_FILE_TYPES = ['pdf', 'word', 'excel', 'powerpoint', 'image', 'text'] as const;
export type LibraryFileType = (typeof LIBRARY_FILE_TYPES)[number];

export const LIBRARY_UPLOAD_ERROR = 'Use a PDF, Word, Excel, PowerPoint, PNG/JPG, TXT or CSV file';

export const LIBRARY_MAX_TAGS = 20;
export const LIBRARY_MAX_TAG_LENGTH = 40;

/** Allow-listed `sort` values for item lists. */
export const LIBRARY_SORTS = ['relevance', 'newest', 'title', 'views', 'downloads'] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export function mimeTypesFor(fileType: LibraryFileType): string[] {
  return Object.entries(LIBRARY_MIME_TYPES)
    .filter(([, t]) => t === fileType)
    .map(([mime]) => mime);
}

/** Lower-case, trim, collapse whitespace, de-duplicate; drops empties. */
export function normalizeTags(tags: string[] | undefined | null): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const t = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
