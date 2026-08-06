'use client';

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import type { PageMeta } from '@abdcshare/api-client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

function pageWindow(current: number, total: number, radius = 2): number[] {
  if (total <= 1) return [1];
  const start = Math.max(1, current - radius);
  const end = Math.min(total, current + radius);
  const pages: number[] = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

export interface ListPaginationProps {
  meta: PageMeta;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  isPending?: boolean;
  className?: string;
}

/** Shared numbered pagination + page-size control (table and card grids). */
export function ListPagination({
  meta,
  pageSize,
  onPageChange,
  onPageSizeChange,
  isPending,
  className,
}: ListPaginationProps) {
  const resolvedPageSize = pageSize ?? meta.pageSize;
  const pages = pageWindow(meta.page, meta.totalPages);
  const rangeStart = meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const rangeEnd = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-3 gap-y-3 text-sm text-muted-foreground',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span>Show</span>
        <Select
          value={String(resolvedPageSize)}
          onValueChange={(v) => onPageSizeChange?.(Number(v))}
          disabled={!onPageSizeChange || isPending}
        >
          <SelectTrigger className="h-8 w-[4.5rem] rounded-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span>entries</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!meta.hasPrev || isPending}
          onClick={() => onPageChange?.(meta.page - 1)}
          aria-label="Previous page"
        >
          <IconChevronLeft className="h-4 w-4" />
        </Button>
        {(pages[0] ?? 1) > 1 ? (
          <>
            <PageButton
              page={1}
              current={meta.page}
              disabled={isPending}
              onClick={onPageChange}
            />
            {(pages[0] ?? 1) > 2 ? <span className="px-1">…</span> : null}
          </>
        ) : null}
        {pages.map((p) => (
          <PageButton
            key={p}
            page={p}
            current={meta.page}
            disabled={isPending}
            onClick={onPageChange}
          />
        ))}
        {(pages[pages.length - 1] ?? 1) < meta.totalPages ? (
          <>
            {(pages[pages.length - 1] ?? 1) < meta.totalPages - 1 ? (
              <span className="px-1">…</span>
            ) : null}
            <PageButton
              page={meta.totalPages}
              current={meta.page}
              disabled={isPending}
              onClick={onPageChange}
            />
          </>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          disabled={!meta.hasNext || isPending}
          onClick={() => onPageChange?.(meta.page + 1)}
          aria-label="Next page"
        >
          <IconChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <span className="min-w-0 truncate tabular-nums">
        {meta.total === 0
          ? '0 entries'
          : `${rangeStart} – ${rangeEnd} of ${meta.total} entries`}
      </span>
    </div>
  );
}

function PageButton({
  page,
  current,
  disabled,
  onClick,
}: {
  page: number;
  current: number;
  disabled?: boolean;
  onClick?: (page: number) => void;
}) {
  const active = page === current;
  return (
    <Button
      type="button"
      variant={active ? 'default' : 'ghost'}
      size="sm"
      className={cn('h-8 min-w-8 px-2', active && 'pointer-events-none')}
      disabled={disabled}
      onClick={() => onClick?.(page)}
    >
      {page}
    </Button>
  );
}
