"use client";

import Link from "next/link";
import {
  IconArrowUpRight,
  IconBriefcase,
  IconClockExclamation,
  IconFileCheck,
  IconHourglassHigh,
  IconUserQuestion,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/data/user-avatar";
import { AttentionList } from "./attention-list";
import { StatCard } from "./stat-card";
import { PartnerStripCard } from "./partner-strip";
import { DASH_ASSETS, EmptyState } from "./decor";
import {
  CHART_COLORS,
  ChartLegend,
  DonutChart,
  ProgressRing,
  SegmentedBar,
  WeeklyActivityChart,
  type DonutSlice,
} from "./charts";
import type { FirmDashboard as FirmData } from "../types";

const STAGE_COLORS: Record<string, string> = {
  Planning: CHART_COLORS.sky,
  Execution: CHART_COLORS.amber,
  Reporting: CHART_COLORS.violet,
  Completed: CHART_COLORS.primary,
  Archived: CHART_COLORS.slate,
};

export function FirmDashboard({ data }: { data: FirmData }) {
  const stageSlices: DonutSlice[] = Object.entries(
    data.engagements.byStage,
  ).map(([name, value]) => ({
    name,
    value,
    color: STAGE_COLORS[name] ?? CHART_COLORS.slate,
  }));

  const submissionSegments = [
    {
      label: "Awaiting review",
      value: data.submissionsByStatus["Pending"] ?? 0,
      color: CHART_COLORS.amber,
    },
    {
      label: "Under review",
      value: data.submissionsByStatus["UnderReview"] ?? 0,
      color: CHART_COLORS.sky,
    },
    {
      label: "Accepted",
      value: data.submissionsByStatus["Accepted"] ?? 0,
      color: CHART_COLORS.primary,
    },
    {
      label: "Returned",
      value: data.submissionsByStatus["Returned"] ?? 0,
      color: CHART_COLORS.red,
    },
  ];

  const maxLoad = Math.max(1, ...data.workloadTop.map((w) => w.open));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Engagements"
          value={data.engagements.total}
          hint={`${data.requests.inScope} requests in scope`}
          icon={IconBriefcase}
          tone="green"
          href="/engagements"
        />
        <StatCard
          label="Overdue requests"
          value={data.requests.overdue}
          hint={
            data.requests.overdue > 0 ? "Need chasing today" : "All on schedule"
          }
          icon={IconClockExclamation}
          tone="red"
          alert={data.requests.overdue > 0}
          href="/requests?due=overdue"
        />
        <StatCard
          label="Due within 7 days"
          value={data.requests.dueSoon}
          hint="Upcoming deadlines"
          icon={IconHourglassHigh}
          tone="amber"
          href="/requests?due=next7Days"
        />
        <StatCard
          label="Unassigned open"
          value={data.requests.unassigned}
          hint={
            data.requests.unassigned > 0
              ? "Waiting for an owner"
              : "Everything owned"
          }
          icon={IconUserQuestion}
          tone="sky"
          href="/requests"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Request activity</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Created vs completed, last 8 weeks
              </p>
            </div>
            <Button
              asChild
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
            >
              <Link href="/requests">
                View all
                <IconArrowUpRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <WeeklyActivityChart data={data.requestTrend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Engagements by stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DonutChart
              data={stageSlices}
              centerValue={String(data.engagements.total)}
              centerLabel="engagements"
              height={170}
            />
            <ChartLegend items={stageSlices} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Delivery health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center gap-4">
              <ProgressRing
                percent={data.progressPercent}
                label="complete"
                size={104}
              />
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-semibold tabular-nums">
                    {data.requests.done}
                  </span>{" "}
                  <span className="text-muted-foreground">requests done</span>
                </p>
                <p>
                  <span className="font-semibold tabular-nums">
                    {data.requests.open}
                  </span>{" "}
                  <span className="text-muted-foreground">still open</span>
                </p>
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Client documents
              </p>
              <SegmentedBar segments={submissionSegments} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Team workload</CardTitle>
            <span className="text-xs text-muted-foreground">open requests</span>
          </CardHeader>
          <CardContent>
            {data.workloadTop.length === 0 ? (
              <EmptyState
                illustration={DASH_ASSETS.folder}
                illustrationDark={DASH_ASSETS.folderDark}
                title="No assigned requests"
                hint="Open requests will appear here once they have owners."
              />
            ) : (
              <ul className="space-y-3">
                {data.workloadTop.map((w) => (
                  <li key={w.userId} className="flex items-center gap-3">
                    <UserAvatar initials={w.fullName.slice(0, 2)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {w.fullName}
                        </p>
                        <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {w.open}
                          {w.overdue > 0 ? (
                            <span className="text-destructive">
                              {" "}
                              · {w.overdue} late
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(w.open / maxLoad) * 100}%`,
                            background:
                              w.overdue > 0
                                ? CHART_COLORS.amber
                                : CHART_COLORS.primary,
                          }}
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Final reports</CardTitle>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="text-muted-foreground"
              >
                <Link href="/admin/final-reports">
                  Open
                  <IconArrowUpRight className="size-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-destructive/5 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <IconFileCheck className="size-4 text-destructive" />
                  Needs firm action
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {data.finalReports.needsFirmAction}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-muted/60 px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm">
                  <IconFileCheck className="size-4 text-primary" />
                  Awaiting client
                </span>
                <span className="text-lg font-bold tabular-nums">
                  {data.finalReports.awaitingClientReview}
                </span>
              </div>
            </CardContent>
          </Card>

          <AttentionList items={data.attention} />
        </div>
      </div>

      {data.partner ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <PartnerStripCard partner={data.partner} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
