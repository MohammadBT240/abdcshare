"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { TeamPanel } from "@/features/engagements/components/workspace/team-panel";
import { ClientContactsPanel } from "@/features/engagements/components/workspace/client-contacts-panel";
import { RequestClassesPanel } from "@/features/engagements/components/workspace/request-classes-panel";
import { SignOffPanel } from "@/features/engagements/components/workspace/sign-off-panel";
import { Input } from "@/components/ui/input";
import { DatePicker, FormField, LoadingButton } from "@/components/forms";
import { IconHistory } from "@tabler/icons-react";
import {
  type EngagementWorkspace,
  useEngagementHistory,
  useUpdateEngagement,
} from "@/features/engagements/hooks/use-engagements";
import { BffClientError } from "@/lib/bff/client";

interface AdminTabProps {
  workspace: EngagementWorkspace;
  canUpdate: boolean;
  canSignOff: boolean;
  currentUserId?: string;
}

export function AdminTab({
  workspace,
  canUpdate,
  canSignOff,
  currentUserId,
}: AdminTabProps) {
  const update = useUpdateEngagement(workspace.id);
  const history = useEngagementHistory(workspace.id);
  const [title, setTitle] = useState(workspace.title);
  const [periodLabel, setPeriodLabel] = useState(workspace.periodLabel ?? "");
  const [startDate, setStartDate] = useState<Date | undefined>(
    workspace.startDate ? new Date(workspace.startDate) : undefined,
  );
  const [targetDate, setTargetDate] = useState<Date | undefined>(
    workspace.targetCompletionDate
      ? new Date(workspace.targetCompletionDate)
      : undefined,
  );

  useEffect(() => {
    setTitle(workspace.title);
    setPeriodLabel(workspace.periodLabel ?? "");
    setStartDate(
      workspace.startDate ? new Date(workspace.startDate) : undefined,
    );
    setTargetDate(
      workspace.targetCompletionDate
        ? new Date(workspace.targetCompletionDate)
        : undefined,
    );
  }, [
    workspace.title,
    workspace.periodLabel,
    workspace.startDate,
    workspace.targetCompletionDate,
  ]);

  async function saveMetadata() {
    if (!title.trim()) {
      toast.error("Enter an engagement title");
      return;
    }
    try {
      await update.mutateAsync({
        title: title.trim(),
        periodLabel: periodLabel.trim() || undefined,
        startDate: startDate?.toISOString().slice(0, 10),
        targetCompletionDate: targetDate?.toISOString().slice(0, 10),
      });
      toast.success("Engagement details updated");
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : "Failed to update engagement",
      );
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-md border border-border bg-card/40 px-3 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Engagement details</h3>
          {canUpdate ? (
            <LoadingButton
              type="button"
              size="sm"
              loading={update.isPending}
              onClick={saveMetadata}
            >
              Save
            </LoadingButton>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Title" required>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={!canUpdate}
              className="h-9"
            />
          </FormField>
          <FormField label="Period">
            <Input
              value={periodLabel}
              onChange={(event) => setPeriodLabel(event.target.value)}
              placeholder="e.g. FY 2026"
              disabled={!canUpdate}
              className="h-9"
            />
          </FormField>
          <FormField label="Start date">
            <DatePicker
              value={startDate}
              onChange={setStartDate}
              disabled={!canUpdate}
            />
          </FormField>
          <FormField label="Target completion">
            <DatePicker
              value={targetDate}
              onChange={setTargetDate}
              disabled={!canUpdate}
            />
          </FormField>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <TeamPanel workspace={workspace} canManageTeam={canUpdate} />
        <ClientContactsPanel workspace={workspace} canManage={canUpdate} />
      </div>

      <div className="grid gap-3 lg:grid-cols-1 lg:items-stretch">
        <RequestClassesPanel
          workspace={workspace}
          canManage={canUpdate}
          canSignOff={canSignOff}
          currentUserId={currentUserId}
        />
      </div>

      <div
        className={
          canSignOff
            ? "grid gap-3 lg:grid-cols-2 lg:items-stretch"
            : "grid gap-3"
        }
      >
        {canSignOff ? (
          <SignOffPanel
            workspace={workspace}
            canSignOff={canSignOff}
            currentUserId={currentUserId}
          />
        ) : null}
        <section className="h-full rounded-md border border-border bg-card/40 px-3 py-2.5">
          <div className="mb-2 flex items-center gap-1.5">
            <IconHistory className="h-3.5 w-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Stage history</h3>
          </div>
          {history.isPending ? (
            <p className="text-sm text-muted-foreground">Loading history…</p>
          ) : history.isError ? (
            <p className="text-sm text-destructive">
              Failed to load engagement history
            </p>
          ) : history.data?.data.length ? (
            <ol className="space-y-0">
              {history.data.data.map((item, index) => (
                <li key={item.id} className="relative flex gap-2.5 py-1.5">
                  {index < history.data.data.length - 1 ? (
                    <span className="absolute left-[5px] top-4 h-[calc(100%-0.25rem)] w-px bg-border" />
                  ) : null}
                  <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 leading-snug">
                    <p className="text-sm font-medium">
                      {item.fromStage
                        ? `${item.fromStage} → ${item.toStage}`
                        : item.toStage}
                      <span className="ml-2 font-normal text-xs text-muted-foreground">
                        {item.changedByName ?? "System"} ·{" "}
                        {new Date(item.changedAt).toLocaleString()}
                      </span>
                    </p>
                    {item.note ? (
                      <p className="text-xs text-muted-foreground">{item.note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">
              No stage changes recorded yet.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
