import { Skeleton } from '@/components/ui/skeleton';

export function PageToolbarSkeleton() {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <Skeleton className="h-10 w-28" />
    </div>
  );
}
