import { Skeleton } from '@/components/ui/skeleton';

export function DataTableSkeleton({
  columns = 5,
  rows = 8,
  showToolbar = true,
}: {
  columns?: number;
  rows?: number;
  /** When false, only render the table block (search is rendered by DataTable). */
  showToolbar?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showToolbar ? (
        <div className="flex justify-between gap-3">
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
        <div className="flex gap-4 border-b border-border bg-muted/50 px-4 py-3">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        <div className="divide-y divide-border/80">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-4">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-40" />
      </div>
    </div>
  );
}
