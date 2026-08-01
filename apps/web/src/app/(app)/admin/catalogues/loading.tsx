import { DataTableSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Shown inside CatalogueShell while a section route is loading. */
export default function CataloguesLoading() {
  return (
    <div>
      <div className="mb-4 space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <DataTableSkeleton />
    </div>
  );
}
