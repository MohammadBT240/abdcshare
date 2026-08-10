'use client';

import Link from 'next/link';
import { IconAlertCircle, IconArrowUpRight } from '@tabler/icons-react';
import {
  AvatarStack,
  CircularProgress,
  DualDateCell,
  UserAvatar,
} from '@/components/data';
import { EngagementStageBadge } from '@/features/engagements/components/engagement-stage-badge';
import type { EngagementListItem } from '@/features/engagements/hooks/use-engagements';
import { cn } from '@/lib/utils';

interface EngagementCardProps {
  engagement: EngagementListItem;
}

/** Compact engagement tile — progress, team, and dates at a glance. */
export function EngagementCard({ engagement }: EngagementCardProps) {
  const hasOverdue = engagement.overdueCount > 0;
  const progress = engagement.progressPercent ?? 0;
  const teamPeople = (engagement.teamPreview ?? []).map((m) => ({
    id: m.userId,
    fullName: m.fullName,
    avatarUrl: m.avatarUrl,
  }));

  return (
    <Link
      href={`/engagements/${engagement.id}`}
      className="group block h-full focus-visible:outline-none"
    >
      <article
        className={cn(
          'flex h-full flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-all',
          'hover:border-primary/35 hover:shadow-md',
          'group-focus-visible:ring-2 group-focus-visible:ring-ring',
          hasOverdue && 'border-destructive/40 bg-destructive/[0.03]',
        )}
      >
        <div className="flex items-start gap-3">
          <UserAvatar
            initials={engagement.clientName}
            size="sm"
            className="mt-0.5 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium text-foreground">
                {engagement.clientName}
              </p>
              <EngagementStageBadge stage={engagement.stage} />
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {engagement.referenceCode}
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug tracking-tight text-foreground">
              {engagement.title}
            </h3>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {[engagement.engagementTypeName, engagement.departmentName, engagement.periodLabel]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <CircularProgress value={progress} size={44} className="shrink-0" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/80 pt-3 text-xs">
          <div className="flex items-center gap-1.5 tabular-nums text-muted-foreground">
            <span className="font-medium text-foreground">{engagement.requestCount}</span>
            <span>requests</span>
            {hasOverdue ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-destructive">
                <IconAlertCircle className="h-3.5 w-3.5" />
                {engagement.overdueCount} overdue
              </span>
            ) : null}
          </div>
          <div className="ml-auto">
            <AvatarStack people={teamPeople} max={3} />
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <DualDateCell
            start={engagement.startDate ?? engagement.createdAt}
            deadline={engagement.targetCompletionDate}
          />
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Open
            <IconArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </article>
    </Link>
  );
}
