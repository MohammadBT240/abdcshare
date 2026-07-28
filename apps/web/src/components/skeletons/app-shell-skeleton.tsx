import { AppHeaderSkeleton } from './app-header-skeleton';
import { AppSidebarSkeleton } from './app-sidebar-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <AppSidebarSkeleton />
      <div className="flex flex-1 flex-col">
        <AppHeaderSkeleton />
        <main className="flex-1 px-4 py-6 lg:px-6">
          <Skeleton className="mb-4 h-8 w-48" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </main>
      </div>
    </div>
  );
}
