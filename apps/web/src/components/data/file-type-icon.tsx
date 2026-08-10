'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  resolveFileIconSources,
  type FileIconKind,
} from '@/lib/file-type-icon';

export interface FileTypeIconProps {
  fileName?: string | null;
  mimeType?: string | null;
  /** Special non-extension glyphs (upload dropzone, generic document). */
  kind?: FileIconKind;
  size?: number;
  className?: string;
  alt?: string;
}

/** Type-aware file glyph from `/public/files`, with dark variants when available. */
export function FileTypeIcon({
  fileName,
  mimeType,
  kind,
  size = 16,
  className,
  alt,
}: FileTypeIconProps) {
  const { light, dark } = resolveFileIconSources({ fileName, mimeType, kind });
  const label =
    alt ??
    (kind === 'upload'
      ? 'Upload'
      : kind === 'folder'
        ? 'Document'
        : fileName
          ? `File type for ${fileName}`
          : 'File');
  const decorative = alt === '';

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src={light}
        alt={decorative ? '' : label}
        width={size}
        height={size}
        className={cn('h-full w-full object-contain dark:hidden')}
        unoptimized
      />
      <Image
        src={dark}
        alt=""
        width={size}
        height={size}
        className={cn('hidden h-full w-full object-contain dark:block')}
        unoptimized
        aria-hidden
      />
    </span>
  );
}
