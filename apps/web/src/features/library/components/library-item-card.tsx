'use client';

import Link from 'next/link';
import { IconArchive, IconDownload, IconEye, IconLock } from '@tabler/icons-react';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { cn } from '@/lib/utils';
import { fileTypeLabel, formatDate } from '@/features/library/lib/library-files';
import type { LibraryItem } from '@/features/library/types';

/** Browse card. The whole card links to the viewer; tags filter the list. */
export function LibraryItemCard({
  item,
  onTagClick,
}: {
  item: LibraryItem;
  onTagClick?: (tag: string) => void;
}) {
  const restricted = item.visibility === 'Departments';
  const meta = [item.authors, item.publishedYear ? String(item.publishedYear) : null].filter(Boolean).join(' · ');

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-xl border border-border/80 bg-card shadow-[var(--shadow-aca)] transition-all',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-ring',
        item.status === 'Archived' && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-inset ring-black/5 dark:ring-white/10">
          <FileTypeIcon fileName={item.fileName ?? 'document'} mimeType={item.mimeType} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-primary/80">
            {item.category.name}
          </p>
          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
            <Link
              href={`/library/${item.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {item.title}
            </Link>
          </h3>
          {meta ? <p className="mt-1 truncate text-xs text-muted-foreground">{meta}</p> : null}
        </div>
      </div>

      {item.description ? (
        <p className="line-clamp-2 px-4 text-sm text-muted-foreground">{item.description}</p>
      ) : null}

      {item.tags.length ? (
        <div className="relative z-10 flex flex-wrap gap-1 px-4 pt-3">
          {item.tags.slice(0, 4).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagClick?.(tag)}
              className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              #{tag}
            </button>
          ))}
          {item.tags.length > 4 ? (
            <span className="px-1 py-0.5 text-[11px] text-muted-foreground">+{item.tags.length - 4}</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-auto flex items-center gap-2 border-t border-border/70 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <span className="rounded bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground/70 ring-1 ring-inset ring-border">
          {fileTypeLabel(item.fileType, item.fileName)}
        </span>
        {restricted ? (
          <span
            className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300"
            title={`Restricted to ${item.departments.map((d) => d.name).join(', ')}`}
          >
            <IconLock className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Restricted to </span>
            {item.departments.length === 1 ? item.departments[0]!.name : `${item.departments.length} depts`}
          </span>
        ) : null}
        {item.status === 'Archived' ? (
          <span className="inline-flex items-center gap-1">
            <IconArchive className="h-3.5 w-3.5" aria-hidden /> Archived
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2.5 tabular-nums">
          <span className="inline-flex items-center gap-1" title="Views">
            <IconEye className="h-3.5 w-3.5" aria-hidden />
            {item.viewCount}
          </span>
          <span className="inline-flex items-center gap-1" title="Downloads">
            <IconDownload className="h-3.5 w-3.5" aria-hidden />
            {item.downloadCount}
          </span>
          <span>{formatDate(item.publishedAt ?? item.createdAt)}</span>
        </span>
      </div>
    </article>
  );
}
