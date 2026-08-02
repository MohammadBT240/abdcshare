/** Maps file names / MIME types to `/public/files` SVG icons. */

const EXT_TO_BASE: Record<string, string> = {
  pdf: 'pdf',
  doc: 'doc',
  docx: 'docx',
  xls: 'xls',
  xlsx: 'xlsx',
  csv: 'csv',
  ppt: 'ppt',
  pptx: 'pptx',
  png: 'png',
  jpg: 'jpg',
  jpeg: 'jpeg',
  gif: 'gif',
  tif: 'tif',
  tiff: 'tif',
  webp: 'blank-image',
  svg: 'blank-image',
  bmp: 'blank-image',
  heic: 'blank-image',
  mp4: 'mp4',
  mov: 'mp4',
  webm: 'mp4',
  zip: 'zip',
  rar: 'rar',
  '7z': 'zip',
  gz: 'zip',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  jsx: 'javascript',
  sql: 'sql',
  ai: 'ai',
};

const MIME_TO_BASE: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'application/csv': 'csv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/tiff': 'tif',
  'image/webp': 'blank-image',
  'image/svg+xml': 'blank-image',
  'video/mp4': 'mp4',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/vnd.rar': 'rar',
  'application/x-rar-compressed': 'rar',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'text/css': 'css',
  'text/javascript': 'javascript',
  'application/javascript': 'javascript',
  'application/sql': 'sql',
  'application/postscript': 'ai',
  'application/illustrator': 'ai',
};

/** Bases that have a `*-dark.svg` sibling in `/files`. */
const DARK_SUFFIX = new Set([
  'ai',
  'blank-image',
  'css',
  'docx',
  'folder-document',
  'pdf',
  'sql',
  'tif',
  'upload',
  'xlsx',
  'xml',
]);

/** Bases that only have a dark variant under `/files/dark/`. */
const DARK_FOLDER = new Set(['doc', 'upload', 'folder-document', 'pdf', 'sql', 'xml', 'css', 'ai', 'tif']);

export type FileIconKind = 'file' | 'upload' | 'folder';

export function extensionFromFileName(fileName?: string | null): string | null {
  if (!fileName) return null;
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export function resolveFileIconBase(
  input?: { fileName?: string | null; mimeType?: string | null; kind?: FileIconKind },
): string {
  if (input?.kind === 'upload') return 'upload';
  if (input?.kind === 'folder') return 'folder-document';

  const mime = input?.mimeType?.toLowerCase().split(';')[0]?.trim();
  if (mime && MIME_TO_BASE[mime]) return MIME_TO_BASE[mime];
  if (mime?.startsWith('image/')) return 'blank-image';
  if (mime?.startsWith('video/')) return 'mp4';
  if (mime?.startsWith('text/')) return 'default';

  const ext = extensionFromFileName(input?.fileName);
  if (ext && EXT_TO_BASE[ext]) return EXT_TO_BASE[ext];

  return 'default';
}

export function fileIconSrc(base: string, theme: 'light' | 'dark' = 'light'): string {
  if (theme === 'dark') {
    if (DARK_SUFFIX.has(base)) return `/files/${base}-dark.svg`;
    if (DARK_FOLDER.has(base)) return `/files/dark/${base}.svg`;
  }
  return `/files/${base}.svg`;
}

export function resolveFileIconSources(input?: {
  fileName?: string | null;
  mimeType?: string | null;
  kind?: FileIconKind;
}): { light: string; dark: string; base: string } {
  const base = resolveFileIconBase(input);
  return {
    base,
    light: fileIconSrc(base, 'light'),
    dark: fileIconSrc(base, 'dark'),
  };
}
