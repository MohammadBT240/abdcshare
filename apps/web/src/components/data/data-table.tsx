'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { IconSearch } from '@tabler/icons-react';
import type { PageMeta } from '@abdcshare/api-client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTableSkeleton } from '@/components/skeletons';
import { ErrorState } from '@/components/data/empty-state';
import { ListPagination } from '@/components/data/list-pagination';
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
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
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
  pageSize,
  onPageSizeChange,
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
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && 'indeterminate')
              }
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
      {onSearchChange || toolbar ? (
        <div className="flex flex-wrap items-center gap-2">
          {onSearchChange ? (
            <div className="relative min-w-0 flex-1 basis-56 max-w-sm">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 rounded-lg border-border bg-background pl-9"
              />
            </div>
          ) : null}
          {toolbar ? <div className="shrink-0">{toolbar}</div> : null}
        </div>
      ) : null}

      {showTableSkeleton ? (
        <DataTableSkeleton columns={tableColumns.length || 5} showToolbar={false} />
      ) : error ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
          <ErrorState message={error} />
        </div>
      ) : (
        <>
          <div
            className={cn(
              'overflow-hidden rounded-xl border border-border bg-card shadow-aca',
              isPending && 'opacity-60',
            )}
          >
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id} className="hover:bg-transparent">
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
                    <TableCell
                      colSpan={tableColumns.length}
                      className="h-24 text-center text-muted-foreground"
                    >
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
            <ListPagination
              meta={meta}
              pageSize={pageSize}
              onPageChange={onPageChange}
              onPageSizeChange={onPageSizeChange}
              isPending={isPending}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
