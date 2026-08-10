'use client';

import Link from 'next/link';
import {
  IconArrowUpRight,
  IconChecklist,
  IconClockExclamation,
  IconFileText,
  IconHourglassHigh,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionList } from './attention-list';
import { StatCard } from './stat-card';
import { PartnerStripCard } from './partner-strip';
import { DayBarsChart, ProgressRing } from './charts';
import { EmptyState } from './decor';
import type { StaffDashboard as StaffData } from '../types';

export function StaffDashboard({ data }: { data: StaffData }) {
  const totalAssigned = data.assigned.open + data.assigned.done;
  const completion =
    totalAssigned > 0 ? Math.round((data.assigned.done / totalAssigned) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My progress</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-5">
            <ProgressRing percent={completion} label="done" size={110} />
            <div className="space-y-1.5 text-sm">
              <p>
                <span className="text-xl font-bold tabular-nums">{data.assigned.open}</span>{' '}
                <span className="text-muted-foreground">open</span>
              </p>
              <p>
                <span className="text-xl font-bold tabular-nums">{data.assigned.done}</span>{' '}
                <span className="text-muted-foreground">completed</span>
              </p>
              {data.assigned.overdue > 0 ? (
                <Badge variant="destructive">{data.assigned.overdue} overdue</Badge>
              ) : (
                <Badge variant="success">Nothing overdue</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">My deadlines this week</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Assigned requests by due day
              </p>
            </div>
            <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
              <Link href="/requests?due=next7Days">
                View all
                <IconArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <DayBarsChart data={data.dueByDay} height={150} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="My overdue"
          value={data.assigned.overdue}
          icon={IconClockExclamation}
          tone="red"
          alert={data.assigned.overdue > 0}
          href="/requests?due=overdue"
        />
        <StatCard
          label="Due within 7 days"
          value={data.assigned.dueSoon}
          icon={IconHourglassHigh}
          tone="amber"
          href="/requests?due=next7Days"
        />
        <StatCard
          label="Submissions to review"
          value={data.submissionsAwaitingReview}
          icon={IconFileText}
          tone="sky"
          href="/requests"
        />
      </div>

      {data.partner ? <PartnerStripCard partner={data.partner} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">My engagements</CardTitle>
            <Link
              href="/reviews"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconChecklist className="size-3.5" />
              {data.reviewsPendingDecision} pending review
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.myEngagements.length === 0 ? (
              <EmptyState
                title="No engagement teams yet"
                hint="Engagements you are added to will show up here."
              />
            ) : (
              data.myEngagements.map((e) => (
                <Link
                  key={e.id}
                  href={`/engagements/${e.id}`}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.referenceCode}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {e.overdueCount > 0 ? (
                      <Badge variant="destructive">{e.overdueCount} overdue</Badge>
                    ) : null}
                    {e.nearestDue ? (
                      <span className="text-xs text-muted-foreground">Due {e.nearestDue}</span>
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <AttentionList items={data.attention} />
      </div>
    </div>
  );
}
