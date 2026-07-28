import { Skeleton } from '@/components/ui/skeleton';

export function AppHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border border-border bg-card px-6 shadow-aca">
      <Skeleton className="h-4 w-40" />
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </header>
  );
}
