'use client';

import Link from 'next/link';
import {
  IconArrowUpRight,
  IconFileCheck,
  IconInbox,
  IconRefresh,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionList } from './attention-list';
import { StatCard } from './stat-card';
import { CHART_COLORS, SegmentedBar } from './charts';
import { DASH_ASSETS, SceneBanner } from './decor';
import type { ClientDashboard as ClientData } from '../types';

export function ClientDashboard({ data }: { data: ClientData }) {
  const submissionSegments = [
    { label: 'Awaiting review', value: data.submissionsByStatus['Pending'] ?? 0, color: CHART_COLORS.amber },
    { label: 'Under review', value: data.submissionsByStatus['UnderReview'] ?? 0, color: CHART_COLORS.sky },
    { label: 'Accepted', value: data.submissionsByStatus['Accepted'] ?? 0, color: CHART_COLORS.primary },
    { label: 'Returned', value: data.submissionsByStatus['Returned'] ?? 0, color: CHART_COLORS.red },
  ];

  return (
    <div className="space-y-4">
      {data.finalReportsAwaitingMe > 0 ? (
        <SceneBanner
          title={`${data.finalReportsAwaitingMe} final report${data.finalReportsAwaitingMe === 1 ? '' : 's'} awaiting your review`}
          description="Approve or request changes so your engagement can move forward."
          art={DASH_ASSETS.pdf}
          artDark={DASH_ASSETS.pdfDark}
          actions={
            <Button asChild size="sm">
              <Link href="/final-reports">Review now</Link>
            </Button>
          }
        />
      ) : data.outstandingRequests === 0 && data.returnedSubmissions === 0 ? (
        <SceneBanner
          title="You are all caught up"
          description="Nothing is waiting on you today. We will notify you when the firm requests documents or shares a report."
          art={DASH_ASSETS.easy.accepted}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Waiting on you"
          value={data.outstandingRequests}
          hint={data.outstandingRequests > 0 ? 'Requests needing your response' : 'All caught up'}
          icon={IconInbox}
          tone="red"
          alert={data.outstandingRequests > 0}
          href="/requests"
        />
        <StatCard
          label="Returned for update"
          value={data.returnedSubmissions}
          hint="Documents to re-upload"
          icon={IconRefresh}
          tone="amber"
          href="/requests"
        />
        <StatCard
          label="Reports to review"
          value={data.finalReportsAwaitingMe}
          hint="Final reports from the firm"
          icon={IconFileCheck}
          tone="green"
          href="/final-reports"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your document pipeline</CardTitle>
            <p className="text-xs text-muted-foreground">
              Everything you have submitted, by review status
            </p>
          </CardHeader>
          <CardContent>
            <SegmentedBar segments={submissionSegments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Your engagements</CardTitle>
            <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
              <Link href="/engagements">
                View all
                <IconArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentEngagements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No engagements yet.</p>
            ) : (
              data.recentEngagements.map((e) => (
                <Link
                  key={e.id}
                  href={`/engagements/${e.id}`}
                  className="flex items-center justify-between rounded-md border border-border bg-card/80 px-3 py-2.5 text-sm transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{e.referenceCode}</p>
                  </div>
                  <Badge variant="secondary">{e.stage}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <AttentionList items={data.attention} />
    </div>
  );
}
