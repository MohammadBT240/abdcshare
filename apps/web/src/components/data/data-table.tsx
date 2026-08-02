'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { PageMeta } from '@abdcshare/api-client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTableSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/data/empty-state';
import { cn } from '@/lib/utils';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  meta?: PageMeta;
  /** Initial load with no rows yet — skeleton only the table body; search stays mounted. */
  isPending?: boolean;
  /** Fetch error — prefer FilterBar outside; this shows inline when set. */
  error?: string | null;
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (q: string) => void;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  getRowId?: (row: T) => string;
}

export function DataTable<T>({
  columns,
  data,
  meta,
  isPending,
  error,
  search,
  searchPlaceholder = 'Search…',
  onSearchChange,
  onPageChange,
  onRowClick,
  emptyMessage = 'No records',
  toolbar,
  selectable,
  selectedIds = [],
  onSelectionChange,
  getRowId,
}: DataTableProps<T>) {
  const tableColumns: ColumnDef<T, unknown>[] = selectable
    ? [
        {
          id: 'select',
          header: ({ table }) => (
            <Checkbox
              checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
              onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
              aria-label="Select all rows"
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
              onClick={(event) => event.stopPropagation()}
              aria-label="Select row"
            />
          ),
        },
        ...columns,
      ]
    : columns;
  const rowSelection = Object.fromEntries(selectedIds.map((id) => [id, true]));
  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    enableRowSelection: selectable,
    state: { rowSelection },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === 'function' ? updater(rowSelection) : updater;
      onSelectionChange?.(Object.keys(next).filter((id) => next[id]));
    },
    manualPagination: true,
    pageCount: meta?.totalPages ?? 1,
  });

  const showTableSkeleton = Boolean(isPending && data.length === 0);

  return (
    <div className="w-full min-w-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange ? (
          <Input
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 min-w-0 flex-1 basis-48 max-w-xs"
          />
        ) : null}
        {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
      </div>

      {showTableSkeleton ? (
        <DataTableSkeleton columns={tableColumns.length || 5} showToolbar={false} />
      ) : error ? (
        <div className="rounded-lg border border-border bg-card shadow-aca">
          <ErrorState message={error} />
        </div>
      ) : (
        <>
          <div
            className={cn(
              'rounded-lg border border-border bg-card shadow-aca',
              isPending && 'opacity-60',
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={tableColumns.length} className="h-24 text-center text-muted-foreground">
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={onRowClick ? 'cursor-pointer' : undefined}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {meta ? (
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <span className="min-w-0 truncate">
                Page {meta.page} of {meta.totalPages} · {meta.total} total
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasPrev || isPending}
                  onClick={() => onPageChange?.(meta.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!meta.hasNext || isPending}
                  onClick={() => onPageChange?.(meta.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
