'use client';

import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { AppHeaderSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { NotificationsBell } from '@/components/layout/notifications-bell';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { UserMenu } from '@/components/layout/user-menu';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/useUIStore';

export function AppHeader() {
  const { user, isPending } = useAuthContext();
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  if (isPending || !user) return <AppHeaderSkeleton />;

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card px-3 shadow-aca lg:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden h-8 w-8 rounded-full px-0 lg:inline-flex"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <IconLayoutSidebarLeftExpand className="h-4 w-4" />
          ) : (
            <IconLayoutSidebarLeftCollapse className="h-4 w-4" />
          )}
        </Button>
        <span className="truncate text-sm font-semibold text-primary">
          Abdulkadeer &amp; Co. (Chartered Accountants)
        </span>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <NotificationsBell />
        <ThemeToggle />
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
