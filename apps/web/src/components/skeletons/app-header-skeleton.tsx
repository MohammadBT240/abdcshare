import { Skeleton } from '@/components/ui/skeleton';

export function AppHeaderSkeleton() {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card px-3 shadow-aca lg:px-5">
      <div className="flex items-center gap-3">
        <Skeleton className="hidden h-8 w-8 rounded-full lg:block" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </header>
  );
}
