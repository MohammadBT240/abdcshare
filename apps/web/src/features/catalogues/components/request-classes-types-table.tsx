'use client';

import { useEffect, useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import type { PageMeta } from '@abdcshare/api-client';
import { ListPagination, StatusBadge } from '@/components/data';
import { ErrorState } from '@/components/data/empty-state';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CatalogueRow } from '@/features/catalogues/hooks/use-catalogue';
import type { RequestClassTypeGroup } from '@/features/catalogues/lib/group-request-classes-types';
import { cn } from '@/lib/utils';

const EXPAND_MS = 180;
const nestedRowClass =
  'border-0 hover:bg-transparent data-[state=selected]:bg-transparent';

function LevelRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('mt-2 h-px w-full', className)}
      style={{
        backgroundImage:
          'repeating-linear-gradient(to right, hsl(var(--border) / 0.7) 0 3px, transparent 3px 7px)',
      }}
    />
  );
}

function useExpandTransition(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), EXPAND_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  return { mounted, shown };
}

function motionRowClass(shown: boolean, className?: string) {
  return cn(
    nestedRowClass,
    'transition-[opacity,transform] ease-out',
    shown
      ? 'translate-y-0 opacity-100 duration-200'
      : 'pointer-events-none -translate-y-1 opacity-0 duration-150',
    className,
  );
}

export interface RequestClassesTypesTableProps {
  groups: RequestClassTypeGroup[];
  meta: PageMeta;
  isPending?: boolean;
  error?: string | null;
  canManage?: boolean;
  /** Class ids that should stay expanded (e.g. search hit via type). */
  forceExpandedIds?: number[];
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onEditClass?: (row: CatalogueRow) => void;
  onDeactivateClass?: (row: CatalogueRow) => void;
  onReactivateClass?: (row: CatalogueRow) => void;
  onAddType?: (classRow: CatalogueRow) => void;
  onEditType?: (row: CatalogueRow) => void;
  onDeactivateType?: (row: CatalogueRow) => void;
  onReactivateType?: (row: CatalogueRow) => void;
}

function ClassGroupRows({
  group,
  canManage,
  forceOpen,
  onEditClass,
  onDeactivateClass,
  onReactivateClass,
  onAddType,
  onEditType,
  onDeactivateType,
  onReactivateType,
}: {
  group: RequestClassTypeGroup;
  canManage: boolean;
  forceOpen: boolean;
  onEditClass?: (row: CatalogueRow) => void;
  onDeactivateClass?: (row: CatalogueRow) => void;
  onReactivateClass?: (row: CatalogueRow) => void;
  onAddType?: (classRow: CatalogueRow) => void;
  onEditType?: (row: CatalogueRow) => void;
  onDeactivateType?: (row: CatalogueRow) => void;
  onReactivateType?: (row: CatalogueRow) => void;
}) {
  const [open, setOpen] = useState(forceOpen);
  const { mounted, shown } = useExpandTransition(open);
  const isSynthetic = group.class.id < 0;
  const typeCount = group.types.length;
  const colCount = canManage ? 5 : 4;

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  return (
    <>
      <TableRow
        className="cursor-pointer border-border/60 hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
      >
        <TableCell className="w-[40%] min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <IconChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                open ? 'rotate-0' : '-rotate-90',
              )}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{group.class.name}</p>
              <p className="text-xs text-muted-foreground">
                {typeCount} {typeCount === 1 ? 'type' : 'types'}
              </p>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {group.class.code?.trim() ? group.class.code : '—'}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{typeCount}</TableCell>
        <TableCell>
          {isSynthetic ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <StatusBadge status={group.class.isActive} />
          )}
        </TableCell>
        {canManage ? (
          <TableCell onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap justify-end gap-2">
              {!isSynthetic ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEditClass?.(group.class)}
                  >
                    Edit
                  </Button>
                  {group.class.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onDeactivateClass?.(group.class)}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onReactivateClass?.(group.class)}
                    >
                      Reactivate
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onAddType?.(group.class)}
                  >
                    Add type
                  </Button>
                </>
              ) : null}
            </div>
          </TableCell>
        ) : null}
      </TableRow>

      {mounted
        ? group.types.map((type, index) => (
            <TableRow key={type.id} className={motionRowClass(shown)}>
              <TableCell colSpan={colCount} className="p-0">
                <div className="pl-8 pr-4">
                  <div className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{type.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Expected docs: {type.expectedDocuments ?? '—'}
                      </p>
                    </div>
                    <StatusBadge status={type.isActive} />
                    {canManage ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onEditType?.(type)}
                        >
                          Edit
                        </Button>
                        {type.isActive ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onDeactivateType?.(type)}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onReactivateType?.(type)}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </div>
                  {index < group.types.length - 1 ? <LevelRule /> : null}
                </div>
              </TableCell>
            </TableRow>
          ))
        : null}

      {mounted && group.types.length === 0 ? (
        <TableRow className={motionRowClass(shown)}>
          <TableCell colSpan={colCount} className="py-2 pl-10 text-sm text-muted-foreground">
            No request types in this class.
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function RequestClassesTypesTable({
  groups,
  meta,
  isPending,
  error,
  canManage = false,
  forceExpandedIds = [],
  pageSize,
  onPageChange,
  onPageSizeChange,
  onEditClass,
  onDeactivateClass,
  onReactivateClass,
  onAddType,
  onEditType,
  onDeactivateType,
  onReactivateType,
}: RequestClassesTypesTableProps) {
  const forceSet = new Set(forceExpandedIds);
  const showSkeleton = Boolean(isPending && groups.length === 0);
  const colCount = canManage ? 5 : 4;

  if (showSkeleton) {
    return <DataTableSkeleton columns={colCount} showToolbar={false} />;
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Types</TableHead>
              <TableHead>Status</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={colCount}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No request classes found
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <ClassGroupRows
                  key={group.class.id}
                  group={group}
                  canManage={canManage}
                  forceOpen={forceSet.has(group.class.id)}
                  onEditClass={onEditClass}
                  onDeactivateClass={onDeactivateClass}
                  onReactivateClass={onReactivateClass}
                  onAddType={onAddType}
                  onEditType={onEditType}
                  onDeactivateType={onDeactivateType}
                  onReactivateType={onReactivateType}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <ListPagination
        meta={meta}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        isPending={isPending}
      />
    </div>
  );
}
