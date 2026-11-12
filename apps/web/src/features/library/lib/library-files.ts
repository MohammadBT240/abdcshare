import type { LibraryFileType, LibrarySort } from '@/features/library/types';

/** Mirrors the API allow-list (apps/api/src/modules/library/library.constants.ts). */
export const LIBRARY_MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  csv: 'text/csv',
};

export const LIBRARY_TYPES = new Set(Object.values(LIBRARY_MIME_BY_EXT));

export const LIBRARY_ACCEPT = [
  ...Object.keys(LIBRARY_MIME_BY_EXT).map((ext) => `.${ext}`),
  ...LIBRARY_TYPES,
].join(',');

export const LIBRARY_MAX_BYTES = 100 * 1024 * 1024;

export const LIBRARY_FILE_HINT = 'PDF, Word, Excel, PowerPoint, PNG/JPG, TXT or CSV — up to 100 MB.';

export const FILE_TYPE_OPTIONS: { value: LibraryFileType; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'image', label: 'Image' },
  { value: 'text', label: 'Text / CSV' },
];

export const SORT_OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'relevance', label: 'Best match' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'views', label: 'Most viewed' },
  { value: 'downloads', label: 'Most downloaded' },
];

function extension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
}

/**
 * Browsers sometimes report an empty or generic MIME (e.g. `.csv` on Windows, `.docx` from
 * some sync folders). The API validates MIME + extension, so derive the MIME from the
 * extension when the browser gives nothing useful.
 */
export function withLibraryMime(file: File): File {
  const fromExt = LIBRARY_MIME_BY_EXT[extension(file.name)];
  if (!fromExt) return file;
  if (file.type && LIBRARY_TYPES.has(file.type)) return file;
  return new File([file], file.name, { type: fromExt, lastModified: file.lastModified });
}

/** `"IFRS_17-primer v2.pdf"` → `"IFRS 17 primer v2"`. */
export function titleFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  return base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

export function formatBytes(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fileTypeLabel(fileType?: LibraryFileType | null, fileName?: string | null): string {
  const ext = fileName ? extension(fileName) : '';
  if (ext) return ext.toUpperCase();
  return FILE_TYPE_OPTIONS.find((o) => o.value === fileType)?.label ?? 'FILE';
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 40);
}
