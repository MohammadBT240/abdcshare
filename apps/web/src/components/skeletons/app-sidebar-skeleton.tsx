import { Skeleton } from '@/components/ui/skeleton';

export function AppSidebarSkeleton() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-gradient-to-b from-sidebar-from to-sidebar-to px-3.5 py-4 lg:flex">
      <Skeleton className="h-[3.25rem] w-full rounded-xl bg-white/10" />
      <div className="mt-7 flex-1 space-y-6">
        {Array.from({ length: 3 }).map((_, section) => (
          <div key={section} className="space-y-2">
            <Skeleton className="mx-3 h-2.5 w-14 bg-white/15" />
            <Skeleton className="h-9 w-full rounded-lg bg-white/12" />
            <Skeleton className="h-9 w-full rounded-lg bg-white/8" />
            {section < 2 ? (
              <Skeleton className="h-9 w-full rounded-lg bg-white/8" />
            ) : null}
          </div>
        ))}
      </div>
      <Skeleton className="h-8 w-full rounded-lg bg-white/10" />
    </aside>
  );
}
