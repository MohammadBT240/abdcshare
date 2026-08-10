import { Skeleton } from '@/components/ui/skeleton';

export function FormCardSkeleton() {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-aca">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}
