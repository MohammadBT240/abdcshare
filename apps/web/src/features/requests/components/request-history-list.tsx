'use client';

import type { ReactNode } from 'react';
import {
  IconArrowsExchange,
  IconCircleCheck,
  IconHistory,
  IconPencil,
  IconPlus,
  IconUserPlus,
  IconUserMinus,
} from '@tabler/icons-react';
import { UserAvatar } from '@/components/data/user-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  useRequestHistory,
  type RequestHistoryItem,
} from '@/features/requests/hooks/use-requests';

interface RequestHistoryListProps {
  requestId: string;
  enabled?: boolean;
}

function initialsFromName(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`;
}

function eventMeta(eventType: string): {
  label: string;
  icon: ReactNode;
  tone: string;
} {
  switch (eventType) {
    case 'Created':
      return {
        label: 'Created',
        icon: <IconPlus className="h-3.5 w-3.5" />,
        tone: 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
      };
    case 'Updated':
      return {
        label: 'Updated',
        icon: <IconPencil className="h-3.5 w-3.5" />,
        tone: 'bg-muted text-muted-foreground',
      };
    case 'StageChanged':
      return {
        label: 'Stage changed',
        icon: <IconArrowsExchange className="h-3.5 w-3.5" />,
        tone: 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200',
      };
    case 'StatusChanged':
      return {
        label: 'Status changed',
        icon: <IconCircleCheck className="h-3.5 w-3.5" />,
        tone: 'bg-primary/10 text-primary',
      };
    case 'Assigned':
      return {
        label: 'Assigned',
        icon: <IconUserPlus className="h-3.5 w-3.5" />,
        tone: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      };
    case 'Unassigned':
      return {
        label: 'Unassigned',
        icon: <IconUserMinus className="h-3.5 w-3.5" />,
        tone: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200',
      };
    default:
      return {
        label: eventType.replace(/([a-z])([A-Z])/g, '$1 $2'),
        icon: <IconHistory className="h-3.5 w-3.5" />,
        tone: 'bg-muted text-muted-foreground',
      };
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function HistoryRow({ item, isLast }: { item: RequestHistoryItem; isLast: boolean }) {
  const meta = eventMeta(item.eventType);
  const actor = item.actorName ?? 'System';

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? (
        <span
          className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
          aria-hidden
        />
      ) : null}
      <UserAvatar
        src={item.actorAvatarUrl}
        initials={initialsFromName(item.actorName)}
        alt={actor}
        size="sm"
        className="relative z-[1] shrink-0 ring-2 ring-background"
      />
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="secondary"
            className={cn('h-5 gap-1 border-transparent px-1.5 text-[10px]', meta.tone)}
          >
            {meta.icon}
            {meta.label}
          </Badge>
          <time
            dateTime={item.createdAt}
            className="text-[11px] text-muted-foreground"
          >
            {formatWhen(item.createdAt)}
          </time>
        </div>

        <p className="text-sm font-medium text-foreground">
          <span className="text-foreground">{actor}</span>
          {item.fromValue || item.toValue ? (
            <span className="font-normal text-muted-foreground">
              {' '}
              {item.fromValue ? (
                <>
                  changed{' '}
                  <span className="line-through decoration-muted-foreground/70">
                    {item.fromValue}
                  </span>
                  {item.toValue ? (
                    <>
                      {' '}
                      to <span className="font-medium text-foreground">{item.toValue}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  set to <span className="font-medium text-foreground">{item.toValue}</span>
                </>
              )}
            </span>
          ) : item.note ? (
            <span className="font-normal text-muted-foreground"> — {item.note}</span>
          ) : null}
        </p>

        {item.note && (item.fromValue || item.toValue) ? (
          <p className="rounded-md border border-border/80 bg-muted/30 px-2.5 py-1.5 text-xs text-muted-foreground">
            {item.note}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function RequestHistoryList({ requestId, enabled = true }: RequestHistoryListProps) {
  const history = useRequestHistory(requestId, enabled);
  const items = history.data?.data ?? [];

  if (history.isPending) {
    return <p className="text-sm text-muted-foreground">Loading history…</p>;
  }

  if (history.isError) {
    return <p className="text-sm text-destructive">Failed to load history</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
        <IconHistory className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No history yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-4 sm:px-4">
      <ul className="space-y-0">
        {items.map((item, index) => (
          <HistoryRow
            key={item.id}
            item={item}
            isLast={index === items.length - 1}
          />
        ))}
      </ul>
    </div>
  );
}
