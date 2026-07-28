import { Skeleton } from '@/components/ui/skeleton';

export function AppSidebarSkeleton() {
  return (
    <aside className="hidden w-64 shrink-0 bg-gradient-to-b from-sidebar-from to-sidebar-to p-4 lg:block">
      <Skeleton className="mb-6 h-7 w-32 bg-white/20" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-white/15" />
        ))}
      </div>
    </aside>
  );
}
