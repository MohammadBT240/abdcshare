"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  IconAlertCircle,
  IconClock,
  IconFileText,
  IconUsers,
} from "@tabler/icons-react";
import { UserAvatar } from "@/components/data/user-avatar";
import { MetricCard } from "@/components/data/metric-card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PlanningDocumentsPanel } from "@/features/engagements/components/workspace/planning-documents-panel";
import type { EngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import { STAGE_STYLES } from "@/features/engagements/lib/stage-styles";
import { useSupportingDocuments } from "@/features/documents/hooks/use-supporting-documents";
import { useRequestsList } from "@/features/requests/hooks/use-requests";
import {
  emptySubmissionCounts,
  SubmissionMetricCards,
} from "@/features/submissions/components/submission-metric-cards";
import { cn } from "@/lib/utils";

interface OverviewTabProps {
  workspace: EngagementWorkspace;
  canUpload: boolean;
  canDeleteAny: boolean;
  currentUserId?: string | null;
}

export function OverviewTab({
  workspace,
  canUpload,
  canDeleteAny,
  currentUserId,
}: OverviewTabProps) {
  const unsigned = workspace.missingRequestClassIds?.length ?? 0;
  const docs = useSupportingDocuments(workspace.id);
  const requests = useRequestsList(`engagementId=${workspace.id}&pageSize=100`);
  const planningRequests = useMemo(
    () => (requests.data?.data ?? []).filter((r) => r.phase === "Planning"),
    [requests.data],
  );
  const docCount = docs.data?.data?.length ?? 0;
  const inPlanning = workspace.stage === "Planning";

  const teamAndClasses = (
    <div className="space-y-3">
      <section className="rounded-md border border-border bg-card px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Team</h3>
          <span className="text-xs text-muted-foreground">
            <IconUsers className="mr-1 inline h-3.5 w-3.5" />
            {workspace.team.length}
          </span>
        </div>
        {workspace.team.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No team yet — add under Settings.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
            {workspace.team.map((m) => (
              <li
                key={m.userId}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <UserAvatar
                  src={m.avatarUrl}
                  initials={m.fullName.slice(0, 2)}
                  size="sm"
                />
                <span className="font-medium">{m.fullName}</span>
                <span className="text-muted-foreground">{m.memberRole}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border bg-card px-3 py-2.5">
        <h3 className="mb-2 text-sm font-semibold">Request classes</h3>
        {(workspace.classRollups?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">None in scope yet.</p>
        ) : (
          <ul className="grid max-h-72 gap-1.5 overflow-y-auto pr-1">
            {workspace.classRollups.map((rc) => (
              <li
                key={rc.requestClassId}
                className="rounded-md border border-border bg-background px-2.5 py-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span title={rc.name} className="truncate text-sm font-medium">
                    {rc.name}
                  </span>
                  {rc.total === 0 ? (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted/60">
                      No requests
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium",
                        rc.signedOff
                          ? "bg-primary/10 text-primary dark:bg-emerald-950/40 dark:text-emerald-300"
                          : "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
                      )}
                    >
                      {rc.signedOff ? "Signed off" : "Open"}
                    </span>
                  )}
                </div>
                {rc.total > 0 ? (
                  <>
                    <Progress value={rc.progressPercent} className="mt-1 h-1.5" />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {rc.progressPercent}% · {rc.done}/{rc.total} done
                      {rc.overdue > 0 ? ` · ${rc.overdue} overdue` : ""}
                    </p>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {unsigned > 0 && !workspace.hasEngagementWideSignOff ? (
          <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
            {unsigned} class{unsigned === 1 ? "" : "es"} still need sign-off
            (Settings).
          </p>
        ) : null}
      </section>
    </div>
  );

  const planningPack = (
    <Accordion
      type="single"
      collapsible
      defaultValue={inPlanning ? "planning-pack" : undefined}
      className="rounded-md border border-border bg-card"
    >
      <AccordionItem value="planning-pack" className="border-b-0 px-3">
        <AccordionTrigger className="py-2.5 hover:no-underline">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 text-left">
            <span className="text-sm font-semibold">Planning pack</span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {docCount} doc{docCount === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {planningRequests.length} request
              {planningRequests.length === 1 ? "" : "s"}
            </Badge>
          </span>
        </AccordionTrigger>
        <AccordionContent className="space-y-4 pb-3">
          <PlanningDocumentsPanel
            engagementId={workspace.id}
            canUpload={canUpload}
            canDeleteAny={canDeleteAny}
            currentUserId={currentUserId}
          />

          <section className="space-y-2">
            <div>
              <h3 className="text-sm font-semibold">Planning-phase requests</h3>
              <p className="text-xs text-muted-foreground">
                Requests stamped while this engagement was in Planning
              </p>
            </div>
            {requests.isPending ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : requests.isError ? (
              <p className="text-sm text-destructive">Failed to load requests.</p>
            ) : planningRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No planning-phase requests yet. Create them from the Requests
                tab.
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {planningRequests.map((req) => (
                  <li key={req.id}>
                    <Link
                      href={`/requests/${req.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-1.5 text-sm transition-colors hover:bg-muted/50"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-medium">{req.referenceCode}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {req.requestClassName}
                        </Badge>
                        {req.isOverdue ? (
                          <Badge variant="destructive" className="text-[10px]">
                            <IconAlertCircle className="mr-0.5 h-3 w-3" />
                            Overdue
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {req.requestTypeName} · {req.status}
                        </span>
                      </div>
                      {req.dueDate ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <IconClock className="h-3 w-3" />
                          {new Date(req.dueDate).toLocaleDateString()}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Requests"
          value={String(workspace.requestCount)}
          illustration="/illustrations/easy/2.svg"
          illustrationDark="/illustrations/easy/2-dark.svg"
          icon={<IconFileText className="h-3.5 w-3.5 text-muted-foreground" />}
        >
          <div className="mt-1.5 flex flex-wrap gap-1">
            <PhaseChip
              stage="Planning"
              count={workspace.phaseCounts.Planning}
            />
            <PhaseChip
              stage="Execution"
              count={workspace.phaseCounts.Execution}
            />
            <PhaseChip
              stage="Reporting"
              count={workspace.phaseCounts.Reporting}
            />
          </div>
        </MetricCard>
        <MetricCard
          label="Overdue"
          value={String(workspace.overdueCount)}
          hint={workspace.overdueCount > 0 ? "Needs attention" : "None overdue"}
          illustration="/illustrations/easy/3.svg"
          illustrationDark="/illustrations/easy/3-dark.svg"
          className={
            workspace.overdueCount > 0
              ? "bg-destructive/5 dark:bg-destructive/10"
              : undefined
          }
          icon={
            <IconAlertCircle
              className={cn(
                "h-3.5 w-3.5",
                workspace.overdueCount > 0
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            />
          }
          valueClass={
            workspace.overdueCount > 0 ? "text-destructive" : undefined
          }
        />
      </div>

      <section className="space-y-1.5">
        <div>
          <h3 className="text-sm font-semibold">Client documents</h3>
          <p className="text-xs text-muted-foreground">
            Current files by review status across this engagement
          </p>
        </div>
        <SubmissionMetricCards
          counts={workspace.submissionCounts ?? emptySubmissionCounts()}
        />
      </section>

      {workspace.analytics ? (
        <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
          <RequestAgingPanel
            engagementId={workspace.id}
            aging={workspace.analytics.aging}
          />
          <WorkloadPanel
            engagementId={workspace.id}
            rows={workspace.analytics.workloadByMember}
            unassignedOpen={workspace.analytics.unassignedOpen}
            unassignedOverdue={workspace.analytics.unassignedOverdue}
          />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        {inPlanning ? (
          <>
            {planningPack}
            {teamAndClasses}
          </>
        ) : (
          <>
            {teamAndClasses}
            {planningPack}
          </>
        )}
      </div>
    </div>
  );
}

function PhaseChip({
  stage,
  count,
}: {
  stage: "Planning" | "Execution" | "Reporting";
  count: number;
}) {
  const style = STAGE_STYLES[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        style.className,
      )}
    >
      {count}
      {stage === "Planning" ? "P" : stage === "Execution" ? "E" : "R"}
    </span>
  );
}

function RequestAgingPanel({
  engagementId,
  aging,
}: {
  engagementId: string;
  aging: NonNullable<EngagementWorkspace["analytics"]>["aging"];
}) {
  const requestsHref = `/engagements/${engagementId}?tab=requests`;
  const buckets: Array<{
    key: keyof typeof aging;
    label: string;
    tone?: string;
  }> = [
    { key: "overdue", label: "Overdue", tone: "text-destructive" },
    { key: "dueToday", label: "Due today" },
    { key: "dueThisWeek", label: "Due this week" },
    { key: "later", label: "Later" },
    { key: "noDue", label: "No due date" },
  ];
  const total = buckets.reduce((sum, b) => sum + aging[b.key], 0);

  return (
    <section className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Request aging</h3>
        <span className="text-xs text-muted-foreground">{total} open</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No open requests.</p>
      ) : (
        <ul className="space-y-2">
          {buckets.map((b) => {
            const count = aging[b.key];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={b.key}>
                <Link
                  href={requestsHref}
                  className="block rounded-md transition-colors hover:bg-muted/40"
                >
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <span className={cn("font-semibold tabular-nums", b.tone)}>
                      {count}
                    </span>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function WorkloadPanel({
  engagementId,
  rows,
  unassignedOpen,
  unassignedOverdue,
}: {
  engagementId: string;
  rows: NonNullable<EngagementWorkspace["analytics"]>["workloadByMember"];
  unassignedOpen: number;
  unassignedOverdue: number;
}) {
  const maxOpen = Math.max(1, ...rows.map((r) => r.open), unassignedOpen);

  return (
    <section className="rounded-md border border-border bg-card px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Workload by member</h3>
        <Link
          href={`/engagements/${engagementId}?tab=requests`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          View requests
        </Link>
      </div>
      {rows.length === 0 && unassignedOpen === 0 ? (
        <p className="text-sm text-muted-foreground">No team workload yet.</p>
      ) : (
        <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
          {unassignedOpen > 0 ? (
            <li className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Unassigned</span>
                <span className="tabular-nums text-muted-foreground">
                  {unassignedOpen} open
                  {unassignedOverdue > 0 ? (
                    <span className="text-destructive">
                      {" "}
                      · {unassignedOverdue} overdue
                    </span>
                  ) : null}
                </span>
              </div>
              <Progress
                value={Math.round((unassignedOpen / maxOpen) * 100)}
                className="h-1.5"
              />
            </li>
          ) : null}
          {rows.map((row) => (
            <li key={row.userId} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium">
                  {row.fullName}
                  {row.memberRole ? (
                    <span className="ml-1 text-muted-foreground">
                      · {row.memberRole}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {row.open} open
                  {row.overdue > 0 ? (
                    <span className="text-destructive">
                      {" "}
                      · {row.overdue} overdue
                    </span>
                  ) : null}
                </span>
              </div>
              <Progress
                value={Math.round((row.open / maxOpen) * 100)}
                className="h-1.5"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
