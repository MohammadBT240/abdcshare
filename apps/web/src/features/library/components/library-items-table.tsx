'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { type ColumnDef } from '@tanstack/react-table';
import { IconLock, IconWorld } from '@tabler/icons-react';
import type { PageMeta } from '@abdcshare/api-client';
import { DataTable } from '@/components/data/data-table';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { formatDate } from '@/features/library/lib/library-files';
import type { LibraryItem } from '@/features/library/types';

export function LibraryItemsTable({
  items,
  meta,
  isPending,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onRowClick,
}: {
  items: LibraryItem[];
  meta?: PageMeta;
  isPending: boolean;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRowClick: (item: LibraryItem) => void;
}) {
  const columns = useMemo<ColumnDef<LibraryItem, unknown>[]>(
    () => [
      {
        header: 'Title',
        id: 'title',
        cell: ({ row }) => (
          <div className="flex min-w-[16rem] items-center gap-3">
            <FileTypeIcon fileName={row.original.fileName ?? 'document'} mimeType={row.original.mimeType} size={24} />
            <div className="min-w-0">
              <Link
                href={`/library/${row.original.id}`}
                className="line-clamp-1 font-medium text-foreground hover:text-primary"
                onClick={(e) => e.stopPropagation()}
              >
                {row.original.title}
              </Link>
              <p className="truncate text-xs text-muted-foreground">{row.original.category.name}</p>
            </div>
          </div>
        ),
      },
      {
        header: 'Author / year',
        id: 'authors',
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {[row.original.authors, row.original.publishedYear].filter(Boolean).join(' · ') || '—'}
          </span>
        ),
      },
      {
        header: 'Tags',
        id: 'tags',
        cell: ({ row }) =>
          row.original.tags.length ? (
            <div className="flex max-w-[14rem] flex-wrap gap-1">
              {row.original.tags.slice(0, 3).map((t) => (
                <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  #{t}
                </span>
              ))}
              {row.original.tags.length > 3 ? (
                <span className="text-[11px] text-muted-foreground">+{row.original.tags.length - 3}</span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        header: 'Access',
        id: 'visibility',
        cell: ({ row }) =>
          row.original.visibility === 'Firm' ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <IconWorld className="h-3.5 w-3.5" aria-hidden /> Firm-wide
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"
              title={row.original.departments.map((d) => d.name).join(', ')}
            >
              <IconLock className="h-3.5 w-3.5" aria-hidden />
              {row.original.departments.map((d) => d.name).join(', ')}
            </span>
          ),
      },
      {
        header: 'Uploaded by',
        id: 'uploadedBy',
        cell: ({ row }) => <span className="text-sm">{row.original.uploadedBy.name}</span>,
      },
      {
        header: 'Added',
        id: 'publishedAt',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm text-muted-foreground">
            {formatDate(row.original.publishedAt ?? row.original.createdAt)}
          </span>
        ),
      },
      {
        header: 'Views',
        id: 'views',
        cell: ({ row }) => <span className="tabular-nums text-sm text-muted-foreground">{row.original.viewCount}</span>,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      meta={meta}
      isPending={isPending}
      onPageChange={onPageChange}
      pageSize={pageSize}
      onPageSizeChange={onPageSizeChange}
      onRowClick={onRowClick}
      getRowId={(row) => row.id}
      emptyMessage="No items match these filters."
    />
  );
}
