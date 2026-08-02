'use client';

import Link from 'next/link';
import { IconAlertCircle, IconFileText, IconUsers } from '@tabler/icons-react';
import { Card, CardContent } from '@/components/ui/card';
import { EngagementStageBadge } from '@/features/engagements/components/engagement-stage-badge';
import type { EngagementListItem } from '@/features/engagements/hooks/use-engagements';
import { cn } from '@/lib/utils';

interface EngagementCardProps {
  engagement: EngagementListItem;
}

export function EngagementCard({ engagement }: EngagementCardProps) {
  const hasOverdue = engagement.overdueCount > 0;

  return (
    <Link href={`/engagements/${engagement.id}`} className="block focus-visible:outline-none">
      <Card
        className={cn(
          'h-full transition-shadow hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
          hasOverdue && 'border-destructive/30',
        )}
      >
        <CardContent className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {engagement.referenceCode}
              </p>
              <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug">
                {engagement.title}
              </h3>
              {engagement.periodLabel ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{engagement.periodLabel}</p>
              ) : null}
            </div>
            <EngagementStageBadge stage={engagement.stage} />
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground/80">{engagement.clientName}</span>
            <span className="mx-1.5 text-border">·</span>
            {engagement.engagementTypeName}
          </p>

          <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Requests
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums">
                <IconFileText className="h-3.5 w-3.5 text-muted-foreground" />
                {engagement.requestCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Overdue
              </p>
              <p
                className={cn(
                  'mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums',
                  hasOverdue ? 'text-destructive' : 'text-foreground',
                )}
              >
                {hasOverdue ? <IconAlertCircle className="h-3.5 w-3.5" /> : null}
                {engagement.overdueCount}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Team
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold tabular-nums">
                <IconUsers className="h-3.5 w-3.5 text-muted-foreground" />
                {engagement.teamSize}
              </p>
            </div>
          </div>

          {(engagement.startDate || engagement.targetCompletionDate) && (
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {engagement.startDate ? (
                <span>Start {new Date(engagement.startDate).toLocaleDateString()}</span>
              ) : null}
              {engagement.targetCompletionDate ? (
                <span>Target {new Date(engagement.targetCompletionDate).toLocaleDateString()}</span>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
