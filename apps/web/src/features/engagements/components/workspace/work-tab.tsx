"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import { IconPlus, IconHistory, IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AvatarStack,
  CircularProgress,
  DataTable,
  DualDateCell,
  EntityCell,
  FilterBar,
  RowActions,
  StatusPill,
  resolveStatusTone,
  type RowActionItem,
} from "@/components/data";
import { AppSelect, MultiCombobox } from "@/components/forms";
import { CreateRequestDialog } from "@/features/requests/components/create-request-dialog";
import { RequestHistoryDialog } from "@/features/requests/components/request-history-dialog";
import { ClassFilterRail } from "@/features/engagements/components/workspace/class-filter-rail";
import { AddRequestClassDialog } from "@/features/engagements/components/workspace/add-request-class-dialog";
import {
  useRequestsList,
  type RequestListItem,
} from "@/features/requests/hooks/use-requests";
import type { EngagementWorkspace } from "@/features/engagements/hooks/use-engagements";
import { useCatalogueList } from "@/features/catalogues/hooks/use-catalogue";

type PhaseFilter = "All" | "Planning" | "Execution" | "Reporting";

const PAGE_SIZE = 20;

interface WorkTabProps {
  workspace: EngagementWorkspace;
  canCreateRequest: boolean;
  canManageClasses?: boolean;
  selectedClassId: number | "all";
  onSelectClass: (id: number | "all") => void;
  onGoAdmin: () => void;
}

export function WorkTab({
  workspace,
  canCreateRequest,
  canManageClasses = false,
  selectedClassId,
  onSelectClass,
  onGoAdmin,
}: WorkTabProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [addClassOpen, setAddClassOpen] = useState(false);
  const [phase, setPhase] = useState<PhaseFilter>("All");
  const [stageId, setStageId] = useState("");
  const [statusId, setStatusId] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [page, setPage] = useState(1);
  const [historyRequest, setHistoryRequest] = useState<{
    id: string;
    refCode: string;
  } | null>(null);
  const rollups = workspace.classRollups ?? [];
  const requestStages = useCatalogueList(
    "request-stages",
    "pageSize=100&isActive=true",
  );
  const requestStatuses = useCatalogueList(
    "request-statuses",
    "pageSize=100&isActive=true",
  );

  useEffect(() => {
    setPage(1);
    setPhase("All");
  }, [selectedClassId]);

  useEffect(() => {
    setPage(1);
  }, [phase, stageId, statusId, assigneeIds, due]);

  const queryString = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("engagementId", workspace.id);
    sp.set("page", String(page));
    sp.set("pageSize", String(PAGE_SIZE));
    if (phase !== "All") sp.set("phase", phase);
    if (selectedClassId !== "all")
      sp.set("requestClassId", String(selectedClassId));
    if (stageId) sp.set("stageId", stageId);
    if (statusId) sp.set("statusId", statusId);
    if (assigneeIds.length === 1) sp.set("assigneeId", assigneeIds[0]!);
    else if (assigneeIds.length > 1)
      sp.set("assigneeIds", assigneeIds.join(","));
    if (due) sp.set("due", due);
    return sp.toString();
  }, [
    workspace.id,
    page,
    phase,
    selectedClassId,
    stageId,
    statusId,
    assigneeIds,
    due,
  ]);

  const requests = useRequestsList(queryString);
  const rows = requests.data?.data ?? [];
  const meta = requests.data?.meta;

  const phaseCounts = useMemo(() => {
    if (selectedClassId === "all") return workspace.phaseCounts;
    const rollup = rollups.find((r) => r.requestClassId === selectedClassId);
    return (
      rollup?.phaseCounts ?? {
        Planning: 0,
        Execution: 0,
        Reporting: 0,
      }
    );
  }, [selectedClassId, rollups, workspace.phaseCounts]);

  const selectedClassName =
    selectedClassId === "all"
      ? undefined
      : rollups.find((r) => r.requestClassId === selectedClassId)?.name;
  const createClassOptions = rollups.map((r) => ({
    id: r.requestClassId,
    name: r.name,
  }));
  const stageOptions = (requestStages.data?.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
  const statusOptions = (requestStatuses.data?.data ?? []).map((item) => ({
    value: String(item.id),
    label: item.name,
  }));
  const assigneeOptions = (workspace.team ?? []).map((member) => ({
    value: member.userId,
    label: member.fullName,
    description: member.memberRole,
    avatarUrl: member.avatarUrl,
  }));

  const columns = useMemo<ColumnDef<RequestListItem, unknown>[]>(() => {
    const showClass = selectedClassId === "all";

    return [
      {
        id: "request",
        header: "Request",
        cell: ({ row }) => {
          const record = row.original;
          return (
            <EntityCell
              primary={record.referenceCode}
              secondary={record.description || record.requestTypeName}
            />
          );
        },
      },
      ...(showClass
        ? [
            {
              header: "Class",
              accessorKey: "requestClassName",
            } satisfies ColumnDef<RequestListItem, unknown>,
          ]
        : []),
      {
        header: "Phase",
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.phase}</Badge>
        ),
      },
      { header: "Stage", accessorKey: "stage" },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.status ? (
            <StatusPill tone={resolveStatusTone(row.original.status)}>
              {row.original.status}
            </StatusPill>
          ) : (
            "—"
          ),
      },
      {
        id: "progress",
        header: "Progress",
        cell: ({ row }) => (
          <CircularProgress value={row.original.progressPercent ?? 0} />
        ),
      },
      {
        id: "dates",
        header: "Started date",
        cell: ({ row }) => (
          <DualDateCell
            start={row.original.createdAt}
            deadline={row.original.dueDate}
          />
        ),
      },
      {
        header: "Assignees",
        cell: ({ row }) => (
          <AvatarStack
            people={row.original.assignees.map((a) => ({
              id: a.userId,
              fullName: a.fullName,
              avatarUrl: a.avatarUrl,
            }))}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const record = row.original;
          const items: RowActionItem[] = [
            {
              label: "Open",
              icon: <IconExternalLink className="h-4 w-4" />,
              onClick: () => router.push(`/requests/${record.id}`),
            },
            {
              label: "View history",
              icon: <IconHistory className="h-4 w-4" />,
              onClick: () =>
                setHistoryRequest({
                  id: record.id,
                  refCode: record.referenceCode,
                }),
            },
          ];
          return <RowActions items={items} />;
        },
      },
    ];
  }, [selectedClassId, router]);

  if (rollups.length === 0) {
    return (
      <>
        <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
          <p className="text-sm font-medium">No request classes in scope</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add classes before creating requests.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {canManageClasses ? (
              <Button
                type="button"
                size="sm"
                onClick={() => setAddClassOpen(true)}
              >
                <IconPlus className="mr-2 h-4 w-4" />
                Add class
              </Button>
            ) : null}
            {canManageClasses ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onGoAdmin}
              >
                Go to Settings
              </Button>
            ) : null}
          </div>
        </div>
        <AddRequestClassDialog
          open={addClassOpen}
          onOpenChange={setAddClassOpen}
          workspace={workspace}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-52">
          <ClassFilterRail
            rollups={rollups}
            selectedClassId={selectedClassId}
            onSelect={onSelectClass}
            canAddClass={canManageClasses}
            onAddClass={() => setAddClassOpen(true)}
          />
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">
                {selectedClassName ?? "All requests"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {meta ? `${meta.total} total` : "—"} · {workspace.overdueCount}{" "}
                overdue on engagement
              </p>
            </div>
            {canCreateRequest ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <IconPlus className="mr-2 h-4 w-4" />
                Create request
              </Button>
            ) : null}
          </div>

          <Tabs value={phase} onValueChange={(v) => setPhase(v as PhaseFilter)}>
            <TabsList className="h-auto min-h-9 w-full justify-start overflow-x-auto overflow-y-hidden sm:w-auto">
              {(["All", "Planning", "Execution", "Reporting"] as const).map(
                (p) => (
                  <TabsTrigger key={p} value={p} className="h-8 text-xs">
                    {p}
                    {p !== "All" ? (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 px-1.5 py-0 text-[10px]"
                      >
                        {phaseCounts[p]}
                      </Badge>
                    ) : null}
                  </TabsTrigger>
                ),
              )}
            </TabsList>
          </Tabs>

          <FilterBar>
            <div className="grid w-full grid-cols-2 gap-2 sm:contents">
              <AppSelect
                value={stageId}
                onValueChange={setStageId}
                options={[{ value: "", label: "All stages" }, ...stageOptions]}
                placeholder="All stages"
                className="h-9 w-full min-w-0 sm:w-44"
              />
              <AppSelect
                value={statusId}
                onValueChange={setStatusId}
                options={[
                  { value: "", label: "All statuses" },
                  ...statusOptions,
                ]}
                placeholder="All statuses"
                className="h-9 w-full min-w-0 sm:w-44"
              />
              <MultiCombobox
                values={assigneeIds}
                onValuesChange={setAssigneeIds}
                options={assigneeOptions}
                placeholder="All assignees"
                searchPlaceholder="Search assignees…"
                emptyMessage="No matching assignees"
                className="min-h-9 w-full min-w-0 sm:w-56"
                maxChips={1}
              />
              <AppSelect
                value={due}
                onValueChange={setDue}
                options={[
                  { value: "", label: "Any due date" },
                  { value: "overdue", label: "Overdue" },
                  { value: "today", label: "Due today" },
                  { value: "next7Days", label: "Due in 7 days" },
                  { value: "noDue", label: "No due date" },
                ]}
                placeholder="Any due date"
                className="h-9 w-full min-w-0 sm:w-44"
              />
            </div>
          </FilterBar>

          <DataTable
            columns={columns}
            data={rows}
            meta={meta}
            isPending={requests.isPending}
            error={requests.isError ? "Failed to load requests" : null}
            onPageChange={setPage}
            onRowClick={(row) => router.push(`/requests/${row.id}`)}
            emptyMessage={
              canCreateRequest
                ? "No requests match this filter. Create a request to get started."
                : "No requests match this filter."
            }
          />
        </div>
      </div>

      <CreateRequestDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        engagementId={workspace.id}
        engagementTitle={workspace.title}
        workingPhase={
          workspace.stage !== "Completed" && workspace.stage !== "Archived"
            ? workspace.stage
            : undefined
        }
        inScopeClasses={createClassOptions}
        initialRequestClassId={
          selectedClassId !== "all" ? selectedClassId : undefined
        }
        teamMembers={workspace.team ?? []}
      />

      <AddRequestClassDialog
        open={addClassOpen}
        onOpenChange={setAddClassOpen}
        workspace={workspace}
      />

      {historyRequest ? (
        <RequestHistoryDialog
          open={Boolean(historyRequest)}
          onOpenChange={(open) => !open && setHistoryRequest(null)}
          requestId={historyRequest.id}
          requestReferenceCode={historyRequest.refCode}
        />
      ) : null}
    </>
  );
}
