'use client';

import { useQuery } from '@tanstack/react-query';
import { IconBriefcase, IconClock, IconFileCheck, IconInbox, IconUsers } from '@tabler/icons-react';
import { DashboardSkeleton } from '@/components/skeletons';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { bffApi } from '@/lib/bff/client';

interface DashboardSummary {
  engagements: { total: number; byStage?: Record<string, number>; byStatus?: Record<string, number> };
  requests: { inScope: number; overdue: number; assignedToMe: number };
  finalReports: { awaitingClientReview: number };
  notifications: { unread: number };
}

export default function DashboardPage() {
  const { user, isPending } = useAuthContext();
  const summary = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => bffApi<DashboardSummary>('/api/dashboard'),
    staleTime: 30_000,
  });

  if (isPending || !user) return <DashboardSkeleton />;

  const data = summary.data;
  const day = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <div className="space-y-6">
      <PageToolbar
        title="Platform Governance"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Dashboard' },
        ]}
        description={`Welcome back, ${user.fullName}`}
        actions={<Badge variant="success">{day}</Badge>}
      />

      {summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError ? (
        <p className="text-sm text-destructive">Unable to load dashboard stats</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Engagements"
              value={data?.engagements.total ?? 0}
              icon={<IconBriefcase className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="Requests in scope"
              value={data?.requests.inScope ?? 0}
              icon={<IconInbox className="h-5 w-5 text-primary" />}
            />
            <StatCard
              title="Overdue requests"
              value={data?.requests.overdue ?? 0}
              icon={<IconClock className="h-5 w-5 text-destructive" />}
            />
            <StatCard
              title="Assigned to me"
              value={data?.requests.assignedToMe ?? 0}
              icon={<IconUsers className="h-5 w-5 text-primary" />}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Engagements by stage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(data?.engagements.byStage ?? data?.engagements.byStatus ?? {}).map(([stage, count]) => (
                  <div key={stage} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{stage}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                {Object.keys(data?.engagements.byStage ?? data?.engagements.byStatus ?? {}).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No engagement data yet</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Reviews & notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <IconFileCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">
                      {data?.finalReports.awaitingClientReview ?? 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Final reports awaiting client review</p>
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-2xl font-bold">{data?.notifications.unread ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Unread notifications</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-bold">{value}</p>
        </div>
        <div className="rounded-md bg-primary/10 p-2">{icon}</div>
      </CardContent>
    </Card>
  );
}
