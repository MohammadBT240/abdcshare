"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PageMeta } from "@abdcshare/api-client";
import {
  IconChevronDown,
  IconExternalLink,
  IconHistory,
} from "@tabler/icons-react";
import {
  AvatarStack,
  CircularProgress,
  DualDateCell,
  EntityCell,
  ListPagination,
  RowActions,
  StatusPill,
  resolveStatusTone,
  type RowActionItem,
} from "@/components/data";
import { ErrorState } from "@/components/data/empty-state";
import { DataTableSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestListItem } from "@/features/requests/hooks/use-requests";
import {
  groupRequestsByClientEngagementClass,
  type RequestClientGroup,
} from "@/features/requests/lib/group-requests";
import { cn } from "@/lib/utils";

const EXPAND_MS = 180;

/** Nested rows share one client block — suppress default full-width row rules. */
const nestedRowClass =
  "border-0 hover:bg-transparent data-[state=selected]:bg-transparent";

/**
 * Indented dotted rule painted inside a cell’s content box (inherits cell padding,
 * so it never extends under parent gutters). Uses a 1px gradient — more reliable
 * than border-b on zero-height table rows.
 */
function LevelRule({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("mt-2 h-px w-full", className)}
      style={{
        backgroundImage:
          "repeating-linear-gradient(to right, hsl(var(--border) / 0.7) 0 3px, transparent 3px 7px)",
      }}
    />
  );
}

export interface RequestsGroupedTableProps {
  data: RequestListItem[];
  meta?: PageMeta;
  isPending?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  onRowClick?: (row: RequestListItem) => void;
  onViewHistory?: (row: RequestListItem) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
}

function classKey(engagementId: string, classId: number): string {
  return `${engagementId}:${classId}`;
}

function expandClientSubtree(client: RequestClientGroup) {
  const engIds = client.engagements.map((e) => e.engagementId);
  const classKeys = client.engagements.flatMap((e) =>
    e.classes.map((c) => classKey(e.engagementId, c.classId)),
  );
  return { engIds, classKeys };
}

/** Keep children mounted while closing so opacity/transform can animate out. */
function useExpandTransition(open: boolean) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setShown(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), EXPAND_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  return { mounted, shown };
}

function motionRowClass(shown: boolean, className?: string) {
  return cn(
    nestedRowClass,
    "transition-[opacity,transform] ease-out",
    shown
      ? "translate-y-0 opacity-100 duration-200"
      : "pointer-events-none -translate-y-1 opacity-0 duration-150",
    className,
  );
}

export function RequestsGroupedTable({
  data,
  meta,
  isPending,
  error,
  emptyMessage = "No requests found",
  onPageChange,
  pageSize,
  onPageSizeChange,
  onRowClick,
  onViewHistory,
  selectable,
  selectedIds = [],
  onSelectionChange,
}: RequestsGroupedTableProps) {
  const groups = useMemo(
    () => groupRequestsByClientEngagementClass(data),
    [data],
  );
  const allIds = useMemo(() => data.map((r) => r.id), [data]);
  /** S/N + optional checkbox + Request…Actions */
  const colCount = 1 + (selectable ? 1 : 0) + 8;

  const [expandedClients, setExpandedClients] = useState<Set<string>>(
    new Set(),
  );
  const [expandedEngagements, setExpandedEngagements] = useState<Set<string>>(
    new Set(),
  );
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set(),
  );

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  const seedKey = `${meta?.page ?? 1}:${groups[0]?.clientId ?? ""}`;
  const seededKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (seededKeyRef.current === seedKey) return;
    seededKeyRef.current = seedKey;

    const currentGroups = groupsRef.current;
    const first = currentGroups[0];
    if (!first) {
      setExpandedClients(new Set());
      setExpandedEngagements(new Set());
      setExpandedClasses(new Set());
      return;
    }
    const { engIds, classKeys } = expandClientSubtree(first);
    setExpandedClients(new Set([first.clientId]));
    setExpandedEngagements(new Set(engIds));
    setExpandedClasses(new Set(classKeys));
  }, [seedKey]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => selectedSet.has(id));
  const someSelected = allIds.some((id) => selectedSet.has(id));

  function toggleClient(client: RequestClientGroup) {
    const next = new Set(expandedClients);
    if (next.has(client.clientId)) {
      next.delete(client.clientId);
      setExpandedClients(next);
      return;
    }
    next.add(client.clientId);
    setExpandedClients(next);
    const { engIds, classKeys } = expandClientSubtree(client);
    setExpandedEngagements((prev) => new Set([...prev, ...engIds]));
    setExpandedClasses((prev) => new Set([...prev, ...classKeys]));
  }

  function toggleEngagement(engagementId: string, classKeys: string[]) {
    const next = new Set(expandedEngagements);
    if (next.has(engagementId)) {
      next.delete(engagementId);
      setExpandedEngagements(next);
      return;
    }
    next.add(engagementId);
    setExpandedEngagements(next);
    setExpandedClasses((prev) => new Set([...prev, ...classKeys]));
  }

  function toggleClass(key: string) {
    const next = new Set(expandedClasses);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedClasses(next);
  }

  function toggleRow(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectionChange([...next]);
  }

  function toggleAll(checked: boolean) {
    onSelectionChange?.(checked ? [...allIds] : []);
  }

  const showSkeleton = Boolean(isPending && data.length === 0);

  if (showSkeleton) {
    return <DataTableSkeleton columns={colCount} showToolbar={false} />;
  }

  if (error) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
        <ErrorState message={error} />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card shadow-aca",
          isPending && "opacity-60",
        )}
      >
        <div className="max-h-[min(70vh,52rem)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center">S/N</TableHead>
                {selectable ? (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected || (someSelected && "indeterminate")}
                      onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                      aria-label="Select all requests on this page"
                    />
                  </TableHead>
                ) : null}
                <TableHead>Request</TableHead>
                <TableHead>Collaborators</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Started date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                groups.map((client, clientIndex) => (
                  <ClientBlock
                    key={client.clientId}
                    client={client}
                    serialNumber={clientIndex + 1}
                    isLastClient={clientIndex === groups.length - 1}
                    clientOpen={expandedClients.has(client.clientId)}
                    colCount={colCount}
                    selectable={selectable}
                    selectedSet={selectedSet}
                    expandedEngagements={expandedEngagements}
                    expandedClasses={expandedClasses}
                    onToggleClient={() => toggleClient(client)}
                    onToggleEngagement={toggleEngagement}
                    onToggleClass={toggleClass}
                    onToggleRow={toggleRow}
                    onRowClick={onRowClick}
                    onViewHistory={onViewHistory}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {meta ? (
        <ListPagination
          meta={meta}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          isPending={isPending}
        />
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <IconChevronDown
      className={cn(
        "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
        open ? "rotate-0" : "-rotate-90",
      )}
    />
  );
}

function ClientBlock({
  client,
  serialNumber,
  isLastClient,
  clientOpen,
  colCount,
  selectable,
  selectedSet,
  expandedEngagements,
  expandedClasses,
  onToggleClient,
  onToggleEngagement,
  onToggleClass,
  onToggleRow,
  onRowClick,
  onViewHistory,
}: {
  client: RequestClientGroup;
  serialNumber: number;
  isLastClient: boolean;
  clientOpen: boolean;
  colCount: number;
  selectable?: boolean;
  selectedSet: Set<string>;
  expandedEngagements: Set<string>;
  expandedClasses: Set<string>;
  onToggleClient: () => void;
  onToggleEngagement: (engagementId: string, classKeys: string[]) => void;
  onToggleClass: (key: string) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  onRowClick?: (row: RequestListItem) => void;
  onViewHistory?: (row: RequestListItem) => void;
}) {
  const { mounted, shown } = useExpandTransition(clientOpen);

  return (
    <>
      <TableRow
        className={cn(
          nestedRowClass,
          "cursor-pointer bg-muted/45 hover:bg-muted/55",
        )}
        onClick={onToggleClient}
      >
        <TableCell className="w-12 py-3 text-center align-middle">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {serialNumber}
          </span>
        </TableCell>
        <TableCell colSpan={colCount - 1} className="py-3">
          <div className="flex items-center gap-2">
            <Chevron open={clientOpen} />
            <span className="text-sm font-semibold tracking-tight">
              {client.clientName}
            </span>
            <span className="text-xs text-muted-foreground">
              {client.requestCount} request
              {client.requestCount === 1 ? "" : "s"} · {client.engagementCount}{" "}
              engagement
              {client.engagementCount === 1 ? "" : "s"}
            </span>
          </div>
          {mounted ? <LevelRule /> : null}
        </TableCell>
      </TableRow>

      {mounted
        ? client.engagements.map((eng) => {
            const engClassKeys = eng.classes.map((c) =>
              classKey(eng.engagementId, c.classId),
            );
            return (
              <EngagementBlock
                key={eng.engagementId}
                eng={eng}
                engOpen={expandedEngagements.has(eng.engagementId)}
                parentShown={shown}
                colCount={colCount}
                selectable={selectable}
                selectedSet={selectedSet}
                expandedClasses={expandedClasses}
                onToggleEngagement={() =>
                  onToggleEngagement(eng.engagementId, engClassKeys)
                }
                onToggleClass={onToggleClass}
                onToggleRow={onToggleRow}
                onRowClick={onRowClick}
                onViewHistory={onViewHistory}
              />
            );
          })
        : null}

      {!isLastClient ? (
        <TableRow className="border-0 hover:bg-transparent">
          <TableCell colSpan={colCount} className="p-0">
            <div className="h-px w-full bg-border" />
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function EngagementBlock({
  eng,
  engOpen,
  parentShown,
  colCount,
  selectable,
  selectedSet,
  expandedClasses,
  onToggleEngagement,
  onToggleClass,
  onToggleRow,
  onRowClick,
  onViewHistory,
}: {
  eng: RequestClientGroup["engagements"][number];
  engOpen: boolean;
  parentShown: boolean;
  colCount: number;
  selectable?: boolean;
  selectedSet: Set<string>;
  expandedClasses: Set<string>;
  onToggleEngagement: () => void;
  onToggleClass: (key: string) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  onRowClick?: (row: RequestListItem) => void;
  onViewHistory?: (row: RequestListItem) => void;
}) {
  const { mounted, shown } = useExpandTransition(engOpen);

  return (
    <>
      <TableRow
        className={motionRowClass(
          parentShown,
          "cursor-pointer bg-muted/25 hover:bg-muted/35",
        )}
        onClick={onToggleEngagement}
      >
        <TableCell className="w-12" />
        <TableCell colSpan={colCount - 1} className="py-2 pl-8 pr-4">
          <div className="flex flex-wrap items-center gap-2">
            <Chevron open={engOpen} />
            <span className="text-sm font-medium">{eng.engagementTitle}</span>
            {eng.engagementReferenceCode ? (
              <span className="font-mono text-[11px] text-muted-foreground">
                {eng.engagementReferenceCode}
              </span>
            ) : null}
            {eng.phase ? (
              <Badge variant="outline" className="text-[10px]">
                {eng.phase}
              </Badge>
            ) : null}
          </div>
          <LevelRule />
        </TableCell>
      </TableRow>

      {mounted
        ? eng.classes.map((cls) => {
            const key = classKey(eng.engagementId, cls.classId);
            return (
              <ClassBlock
                key={key}
                className={cls.className}
                requestCount={cls.requests.length}
                classOpen={expandedClasses.has(key)}
                requests={cls.requests}
                parentShown={shown}
                colCount={colCount}
                selectable={selectable}
                selectedSet={selectedSet}
                onToggleClass={() => onToggleClass(key)}
                onToggleRow={onToggleRow}
                onRowClick={onRowClick}
                onViewHistory={onViewHistory}
              />
            );
          })
        : null}
    </>
  );
}

function ClassBlock({
  className,
  requestCount,
  classOpen,
  requests,
  parentShown,
  colCount,
  selectable,
  selectedSet,
  onToggleClass,
  onToggleRow,
  onRowClick,
  onViewHistory,
}: {
  className: string;
  requestCount: number;
  classOpen: boolean;
  requests: RequestListItem[];
  parentShown: boolean;
  colCount: number;
  selectable?: boolean;
  selectedSet: Set<string>;
  onToggleClass: () => void;
  onToggleRow: (id: string, checked: boolean) => void;
  onRowClick?: (row: RequestListItem) => void;
  onViewHistory?: (row: RequestListItem) => void;
}) {
  const { mounted, shown } = useExpandTransition(classOpen);

  return (
    <>
      <TableRow
        className={motionRowClass(
          parentShown,
          "cursor-pointer bg-muted/10 hover:bg-muted/20",
        )}
        onClick={onToggleClass}
      >
        <TableCell className="w-12" />
        <TableCell colSpan={colCount - 1} className="py-1.5 pl-14 pr-4">
          <div className="flex items-center gap-2">
            <Chevron open={classOpen} />
            <span className="text-sm text-muted-foreground">{className}</span>
            <span className="text-xs text-muted-foreground/80">
              {requestCount} request{requestCount === 1 ? "" : "s"}
            </span>
          </div>
          <LevelRule />
        </TableCell>
      </TableRow>

      {mounted
        ? requests.map((record) => (
            <LeafRow
              key={record.id}
              record={record}
              selectable={selectable}
              selected={selectedSet.has(record.id)}
              motionShown={shown}
              colCount={colCount}
              onToggleRow={onToggleRow}
              onRowClick={onRowClick}
              onViewHistory={onViewHistory}
            />
          ))
        : null}
    </>
  );
}

function LeafRow({
  record,
  selectable,
  selected,
  motionShown,
  colCount,
  onToggleRow,
  onRowClick,
  onViewHistory,
}: {
  record: RequestListItem;
  selectable?: boolean;
  selected: boolean;
  motionShown: boolean;
  colCount: number;
  onToggleRow: (id: string, checked: boolean) => void;
  onRowClick?: (row: RequestListItem) => void;
  onViewHistory?: (row: RequestListItem) => void;
}) {
  const secondary = [record.requestTypeName, record.description]
    .filter(Boolean)
    .join(" • ");
  const items: RowActionItem[] = [
    {
      label: "Open",
      icon: <IconExternalLink className="h-4 w-4" />,
      onClick: () => onRowClick?.(record),
    },
    {
      label: "View history",
      icon: <IconHistory className="h-4 w-4" />,
      onClick: () => onViewHistory?.(record),
    },
  ];

  return (
    <>
      <TableRow
        className={motionRowClass(
          motionShown,
          cn("bg-transparent hover:bg-muted/20", onRowClick && "cursor-pointer"),
        )}
        onClick={() => onRowClick?.(record)}
      >
        <TableCell className="w-12" />
        {selectable ? (
          <TableCell className="w-10 py-3 pl-4">
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) =>
                onToggleRow(record.id, Boolean(checked))
              }
              onClick={(event) => event.stopPropagation()}
              aria-label={`Select ${record.referenceCode}`}
            />
          </TableCell>
        ) : null}
        <TableCell className={cn("py-3", selectable ? "pl-2" : "pl-16")}>
          <EntityCell primary={record.referenceCode} secondary={secondary} />
        </TableCell>
        <TableCell className="py-3">
          <AvatarStack
            people={record.assignees.map((a) => ({
              id: a.userId,
              fullName: a.fullName,
              avatarUrl: a.avatarUrl,
            }))}
          />
        </TableCell>
        <TableCell className="py-3">
          <Badge variant="outline">{record.phase}</Badge>
        </TableCell>
        <TableCell className="py-3">{record.stage || "—"}</TableCell>
        <TableCell className="py-3">
          {record.status ? (
            <StatusPill tone={resolveStatusTone(record.status)}>
              {record.status}
            </StatusPill>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="py-3">
          <CircularProgress value={record.progressPercent ?? 0} />
        </TableCell>
        <TableCell className="py-3">
          <DualDateCell start={record.createdAt} deadline={record.dueDate} />
        </TableCell>
        <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
          <RowActions items={items} />
        </TableCell>
      </TableRow>
      {/* Indented rule under the leaf — own row so multi-column layout stays intact */}
      <TableRow
        className={cn(
          "border-0 hover:bg-transparent",
          "transition-opacity duration-200",
          motionShown ? "opacity-100" : "opacity-0",
        )}
      >
        <TableCell colSpan={colCount} className="p-0">
          <div className="pl-16 pr-4">
            <LevelRule className="mt-0" />
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}
