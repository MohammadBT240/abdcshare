'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  IconBell,
  IconCheck,
  IconFileExport,
  IconFileText,
  IconMessageCircle,
  IconClipboardCheck,
  IconBriefcase,
  IconAlertCircle,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NotificationsPanelSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications';
import { openExportDownloadLink } from '@/features/submissions/lib/export-toast';
import { BffClientError } from '@/lib/bff/client';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@abdcshare/api-client';

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isExportDownloadLink(link: string): boolean {
  return link.includes('/exports/download');
}

function notificationIcon(type: string) {
  if (type.startsWith('discussion.')) return IconMessageCircle;
  if (type.startsWith('submission.') || type.includes('export')) return IconFileExport;
  if (type.startsWith('document.')) return IconFileText;
  if (type.startsWith('review.') || type.startsWith('report.')) return IconClipboardCheck;
  if (type.startsWith('engagement.')) return IconBriefcase;
  if (type.includes('overdue') || type.includes('deadline')) return IconAlertCircle;
  return IconBell;
}

function NotificationRow({ item }: { item: NotificationItem }) {
  const Icon = notificationIcon(item.type);
  return (
    <div
      className={cn(
        'flex gap-3 px-3.5 py-3 transition-colors',
        !item.isRead ? 'bg-primary/[0.06]' : 'bg-transparent',
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          !item.isRead
            ? 'bg-primary/15 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-start gap-2">
          <p
            className={cn(
              'min-w-0 flex-1 break-words text-sm leading-snug',
              !item.isRead
                ? 'font-semibold text-foreground'
                : 'font-medium text-foreground/90',
            )}
          >
            {item.title}
          </p>
          {!item.isRead ? (
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
              aria-label="Unread"
            />
          ) : null}
        </div>
        {item.body ? (
          <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
            {item.body}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          {formatRelative(item.createdAt)}
        </p>
      </div>
    </div>
  );
}

const rowClassName =
  'block w-full min-w-0 overflow-hidden text-left outline-none hover:bg-muted/60 focus-visible:bg-muted/60';

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
  const items = list.data?.data ?? [];

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

  async function onExportLink(link: string, notificationId: string, isRead: boolean) {
    try {
      if (!isRead) void onMarkOne(notificationId);
      setOpen(false);
      await openExportDownloadLink(link);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    }
  }

  function renderItem(item: NotificationItem): ReactNode {
    const body = <NotificationRow item={item} />;

    if (item.link && isExportDownloadLink(item.link)) {
      return (
        <button
          key={item.id}
          type="button"
          className={rowClassName}
          onClick={() => void onExportLink(item.link!, item.id, item.isRead)}
        >
          {body}
        </button>
      );
    }

    if (item.link) {
      const external = /^https?:\/\//i.test(item.link);
      if (external) {
        return (
          <a
            key={item.id}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className={rowClassName}
            onClick={() => {
              if (!item.isRead) void onMarkOne(item.id);
              setOpen(false);
            }}
          >
            {body}
          </a>
        );
      }
      return (
        <Link
          key={item.id}
          href={item.link}
          className={rowClassName}
          onClick={() => {
            if (!item.isRead) void onMarkOne(item.id);
            setOpen(false);
          }}
        >
          {body}
        </Link>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        className={rowClassName}
        onClick={() => {
          if (!item.isRead) void onMarkOne(item.id);
        }}
      >
        {body}
      </button>
    );
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
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 99 ? '99+' : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-1.25rem),22rem)] overflow-hidden p-0 sm:w-[22rem]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {count > 0 ? (
              <p className="text-[11px] text-muted-foreground">{count} unread</p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 text-xs"
            disabled={count === 0 || markAll.isPending}
            onClick={() => void onMarkAll()}
          >
            <IconCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        </div>

        <ScrollArea className="h-[min(22rem,70vh)]">
          <div className="min-w-0 divide-y divide-border overflow-hidden">
            {list.isPending ? <NotificationsPanelSkeleton /> : null}

            {list.isError ? (
              <p className="px-4 py-8 text-center text-sm text-destructive">
                Unable to load notifications
              </p>
            ) : null}

            {!list.isPending && !list.isError && items.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <IconBell className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium">You&apos;re all caught up</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  New activity will show up here
                </p>
              </div>
            ) : null}

            {!list.isPending && !list.isError ? items.map(renderItem) : null}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
