'use client';

import Link from 'next/link';
import {
  IconArrowUpRight,
  IconCircleCheck,
  IconCircleX,
  IconHistory,
  IconUserOff,
  IconUsers,
  IconUserShield,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AttentionList } from './attention-list';
import { StatCard } from './stat-card';
import { ChartLegend, DonutChart, TrendAreaChart, type DonutSlice } from './charts';
import type { GovernanceDashboard as GovernanceData } from '../types';

const CATALOGUE_ITEMS: Array<{ key: keyof GovernanceData['catalogue']; label: string; href: string }> = [
  { key: 'requestTypes', label: 'Request types', href: '/admin/catalogues/request-classes' },
  { key: 'requestStages', label: 'Request stages', href: '/admin/catalogues/request-stages' },
  { key: 'requestStatuses', label: 'Request statuses', href: '/admin/catalogues/request-statuses' },
  { key: 'engagementTypes', label: 'Engagement types', href: '/admin/catalogues/engagement-types' },
  { key: 'departments', label: 'Departments', href: '/admin/catalogues/departments' },
];

export function GovernanceDashboard({ data }: { data: GovernanceData }) {
  const roleSlices: DonutSlice[] = Object.entries(data.users.byRole)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Users"
          value={data.users.total}
          hint="Across all roles"
          icon={IconUsers}
          tone="green"
          href="/admin/users"
        />
        <StatCard
          label="Must change password"
          value={data.users.mustChangePassword}
          hint="Provisioned, not yet activated"
          icon={IconUserShield}
          tone="amber"
          href="/admin/users"
        />
        <StatCard
          label="Inactive accounts"
          value={data.users.inactive}
          icon={IconUserOff}
          tone="slate"
          href="/admin/users"
        />
        <StatCard
          label="Audit events (7d)"
          value={data.audit.last7Days}
          hint="Platform activity volume"
          icon={IconHistory}
          tone="violet"
          href="/admin/activity"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Users by role</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DonutChart
              data={roleSlices}
              centerValue={String(data.users.total)}
              centerLabel="users"
              height={170}
            />
            <ChartLegend items={roleSlices} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Platform activity</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Audit events per day, last 14 days
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <TrendAreaChart data={data.audit.trend} height={180} name="Audit events" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Catalogue health</CardTitle>
            <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
              <Link href="/admin/catalogues">
                Manage
                <IconArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {CATALOGUE_ITEMS.map((item) => {
              const count = data.catalogue[item.key] as number;
              const healthy = count > 0;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2">
                    {healthy ? (
                      <IconCircleCheck className="size-4 text-primary" />
                    ) : (
                      <IconCircleX className="size-4 text-destructive" />
                    )}
                    {item.label}
                  </span>
                  <span
                    className={
                      healthy
                        ? 'font-semibold tabular-nums'
                        : 'font-semibold text-destructive'
                    }
                  >
                    {healthy ? count : 'Empty'}
                  </span>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <AttentionList items={data.attention} />
      </div>
    </div>
  );
}
