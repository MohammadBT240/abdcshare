'use client';

import { useMemo } from 'react';
import { IconFolders, IconPlus } from '@tabler/icons-react';
import { ErrorState } from '@/components/data/empty-state';
import { ListPagination } from '@/components/data/list-pagination';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BffClientError } from '@/lib/bff/client';
import { useLibraryCollections } from '@/features/library/hooks/use-library-collections';
import { CollectionCard } from '@/features/library/components/collection-card';
import type { LibraryScope } from '@/features/library/components/library-category-rail';

/** Collections view of /library (tab=collections). Filters and paging come from the URL. */
export function LibraryCollectionsTab({
  q,
  scope,
  type,
  year,
  page,
  pageSize,
  isCurator,
  canContribute,
  onPage,
  onPageSize,
  onNew,
  onClear,
}: {
  q: string;
  scope: LibraryScope;
  type: string;
  year: string;
  page: number;
  pageSize: number;
  isCurator: boolean;
  canContribute: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  onNew: () => void;
  onClear: () => void;
}) {
  const apiQuery = useMemo(() => {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) qs.set('q', q);
    if (type) qs.set('type', type);
    if (year) qs.set('year', year);
    if (scope === 'mine') qs.set('mine', 'true');
    if (scope === 'archived') {
      qs.set('status', 'Archived');
      if (!isCurator) qs.set('mine', 'true');
    }
    return qs.toString();
  }, [q, type, year, scope, page, pageSize, isCurator]);
  const list = useLibraryCollections(apiQuery);
  const filtered = Boolean(q || type || year);

  if (list.isError) {
    return <ErrorState message={list.error instanceof BffClientError ? list.error.message : 'Failed to load collections'} />;
  }
  if (list.isPending) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  const rows = list.data.data;
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
        <IconFolders className="h-10 w-10 text-muted-foreground/60" aria-hidden />
        {filtered ? (
          <>
            <p className="mt-3 text-sm font-medium text-foreground">No collections match these filters</p>
            <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onClear}>
              Clear filters
            </Button>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-foreground">
              {scope === 'archived' ? 'No archived collections' : scope === 'mine' ? "You haven't created a collection yet" : 'No collections yet'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Collections keep everything from one training, workshop or project together.
            </p>
            {canContribute && scope !== 'archived' ? (
              <Button type="button" size="sm" className="mt-4" onClick={onNew}>
                <IconPlus className="mr-1.5 h-4 w-4" aria-hidden /> New collection
              </Button>
            ) : null}
          </>
        )}
      </div>
    );
  }
  return (
    <>
      <div className={`grid gap-4 sm:grid-cols-2 2xl:grid-cols-3 ${list.isFetching ? 'opacity-70 transition-opacity' : ''}`}>
        {rows.map((c) => (
          <CollectionCard key={c.id} collection={c} />
        ))}
      </div>
      {list.data.meta.totalPages > 1 ? (
        <ListPagination
          className="mt-6"
          meta={list.data.meta}
          pageSize={pageSize}
          onPageChange={onPage}
          onPageSizeChange={onPageSize}
          isPending={list.isFetching}
        />
      ) : null}
    </>
  );
}
