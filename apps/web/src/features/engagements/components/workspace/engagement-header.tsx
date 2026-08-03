"use client";

import {
  IconArrowRight,
  IconCalendar,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EngagementStageBadge } from "@/features/engagements/components/engagement-stage-badge";
import {
  NextActionChips,
  type NextAction,
} from "@/features/engagements/components/workspace/next-actions";
import type { EngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import type { WorkspaceTab } from "@/features/engagements/lib/workspace-tabs";
import { cn } from "@/lib/utils";

interface EngagementHeaderProps {
  workspace: EngagementWorkspace;
  onTransition?: () => void;
  canTransition: boolean;
  nextActions?: NextAction[];
  onSelectTab?: (tab: WorkspaceTab) => void;
}

const WORKFLOW_STAGES = ["Planning", "Execution", "Reporting"] as const;

const STAGE_BAND: Record<(typeof WORKFLOW_STAGES)[number], string> = {
  Planning:
    "border-sky-200/80 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/30",
  Execution:
    "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/25",
  Reporting:
    "border-teal-200/80 bg-teal-50/70 dark:border-teal-900/50 dark:bg-teal-950/25",
};

const STAGE_ACCENT: Record<(typeof WORKFLOW_STAGES)[number], string> = {
  Planning: "bg-sky-500",
  Execution: "bg-amber-500",
  Reporting: "bg-teal-500",
};

export function EngagementHeader({
  workspace,
  onTransition,
  canTransition,
  nextActions = [],
  onSelectTab,
}: EngagementHeaderProps) {
  const currentIndex = WORKFLOW_STAGES.indexOf(
    workspace.stage as (typeof WORKFLOW_STAGES)[number],
  );
  const isWorkflowStage = currentIndex >= 0;
  const stageKey = isWorkflowStage
    ? (workspace.stage as (typeof WORKFLOW_STAGES)[number])
    : null;

  const meta = [
    workspace.clientName,
    workspace.engagementTypeName,
    workspace.periodLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  const transitionAction = nextActions.find((a) => a.id === "transition");
  const chipActions = nextActions.filter((a) => a.id !== "transition");
  const primaryLabel =
    transitionAction?.label ??
    (canTransition && workspace.allowedNextStages[0]
      ? `Advance to ${workspace.allowedNextStages[0]}`
      : null);
  const showPrimary =
    Boolean(primaryLabel) &&
    canTransition &&
    workspace.allowedNextStages.length > 0 &&
    Boolean(onTransition);

  return (
    <header
      className={cn(
        "relative overflow-hidden rounded-md border px-3 py-3 sm:px-4",
        stageKey ? STAGE_BAND[stageKey] : "border-border bg-card/40",
      )}
    >
      {/* {stageKey ? (
        <span
          aria-hidden
          className={cn('absolute inset-y-0 left-0 w-1', STAGE_ACCENT[stageKey])}
        />
      ) : null} */}

      <div className="flex flex-wrap items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {workspace.referenceCode}
            </span>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {workspace.title}
            </h1>
          </div>
          {meta ? (
            <p className="truncate text-sm text-muted-foreground">{meta}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <EngagementStageBadge stage={workspace.stage} />
          {showPrimary ? (
            <Button onClick={onTransition} size="sm">
              <IconArrowRight className="mr-1.5 h-4 w-4" />
              {primaryLabel}
            </Button>
          ) : null}
        </div>
      </div>

      {isWorkflowStage ? (
        <div className="mt-3 flex flex-col gap-2 pl-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {workspace.progressPercent}%
            </span>
            <Progress
              value={workspace.progressPercent}
              className="h-1.5 flex-1"
            />
            <div className="hidden shrink-0 items-center gap-1 sm:flex">
              {WORKFLOW_STAGES.map((stage, idx) => {
                const isActive = idx === currentIndex;
                const isPast = idx < currentIndex;
                return (
                  <span
                    key={stage}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] font-medium",
                      isActive && "bg-primary text-primary-foreground",
                      isPast && !isActive && "bg-primary/15 text-primary",
                      !isActive && !isPast && "text-muted-foreground",
                    )}
                  >
                    {stage}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {workspace.startDate ? (
              <span className="inline-flex items-center gap-1">
                <IconCalendar className="h-3 w-3" />
                Start {new Date(workspace.startDate).toLocaleDateString()}
              </span>
            ) : null}
            {workspace.targetCompletionDate ? (
              <span className="inline-flex items-center gap-1">
                <IconCalendar className="h-3 w-3" />
                Target{" "}
                {new Date(workspace.targetCompletionDate).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {chipActions.length > 0 && onSelectTab ? (
        <div className="mt-2.5 border-t border-border/60 pl-2 pt-2.5">
          <NextActionChips actions={chipActions} onSelectTab={onSelectTab} />
        </div>
      ) : null}
    </header>
  );
}
