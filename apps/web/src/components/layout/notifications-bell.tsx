'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconBell } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NotificationsPanelSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications';
import { BffClientError } from '@/lib/bff/client';
import { cn } from '@/lib/utils';

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

export function NotificationsBell() {
  const { can } = useAuthContext();
  const allowed = can('notification:receive');
  const [open, setOpen] = useState(false);

  const unread = useUnreadCount(allowed);
  const list = useNotificationList(allowed && open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  if (!allowed) return null;

  const count = unread.data?.count ?? 0;

  async function onMarkAll() {
    try {
      await markAll.mutateAsync();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not mark all read');
    }
  }

  async function onMarkOne(id: string) {
    try {
      await markRead.mutateAsync(id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not mark as read');
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 px-0"
          aria-label={count > 0 ? `${count} unread notifications` : 'Notifications'}
        >
          <IconBell className="h-4 w-4" />
          {count > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={count === 0 || markAll.isPending}
            onClick={() => void onMarkAll()}
          >
            Mark all read
          </Button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {list.isPending ? <NotificationsPanelSkeleton /> : null}

          {list.isError ? (
            <p className="px-4 py-6 text-center text-sm text-destructive">
              Unable to load notifications
            </p>
          ) : null}

          {!list.isPending && !list.isError && (list.data?.data.length ?? 0) === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications</p>
          ) : null}

          {!list.isPending && !list.isError
            ? list.data?.data.map((item) => {
                const content = (
                  <div
                    className={cn(
                      'border-b border-border px-4 py-3 last:border-0',
                      !item.isRead && 'bg-primary/5',
                    )}
                  >
                    <p className="text-sm font-medium leading-snug">{item.title}</p>
                    {item.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRelative(item.createdAt)}
                    </p>
                  </div>
                );

                if (item.link) {
                  return (
                    <Link
                      key={item.id}
                      href={item.link}
                      className="block hover:bg-muted/50"
                      onClick={() => {
                        if (!item.isRead) void onMarkOne(item.id);
                        setOpen(false);
                      }}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    className="block w-full text-left hover:bg-muted/50"
                    onClick={() => {
                      if (!item.isRead) void onMarkOne(item.id);
                    }}
                  >
                    {content}
                  </button>
                );
              })
            : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
