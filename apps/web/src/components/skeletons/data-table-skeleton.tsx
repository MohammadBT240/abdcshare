import { Skeleton } from '@/components/ui/skeleton';

export function DataTableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-11 w-64" />
        <Skeleton className="h-11 w-28" />
      </div>
      <div className="rounded-lg border border-border bg-card p-2 shadow-aca">
        <div className="mb-2 flex gap-2 border-b border-border pb-2">
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={i} className="h-4 flex-1" />
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-2">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="h-8 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
