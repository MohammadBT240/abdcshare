'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  IconCopy,
  IconEye,
  IconFilter,
  IconSearch,
  IconUser,
} from '@tabler/icons-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ChecklistFilter,
  DataTable,
  DateFilterPill,
  EntityCell,
  ExportMenu,
  FilterBar,
  RowActions,
  snColumn,
  useListParams,
  type RowActionItem,
} from '@/components/data';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  downloadActivityLogCsv,
  useActivityLogList,
} from '@/features/activity-log/hooks/use-activity-log';
import { formatAuditAction, truncateId } from '@/features/activity-log/lib/format-audit-action';
import {
  ACTIVITY_ENTITY_TYPE_OPTIONS,
  type ActivityLogRecord,
} from '@/features/activity-log/types';
import { useUsersList } from '@/features/users/hooks/use-users';

function parseDateParam(value?: string): Date | undefined {
  if (!value) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateParam(date?: Date): string | undefined {
  if (!date) return undefined;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ActivityLogInner() {
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const list = useActivityLogList(queryString);
  const users = useUsersList('pageSize=100&isActive=true');
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [detail, setDetail] = useState<ActivityLogRecord | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const userOptions = useMemo(
    () =>
      (users.data?.data ?? []).map((u) => ({
        value: u.id,
        label: u.fullName,
        avatarUrl: u.avatarUrl,
        initials: u.fullName,
      })),
    [users.data],
  );

  const columns = useMemo<ColumnDef<ActivityLogRecord, unknown>[]>(() => {
    const page = list.data?.meta.page ?? params.page;
    const pageSize = list.data?.meta.pageSize ?? params.pageSize;

    return [
      snColumn<ActivityLogRecord>(page, pageSize),
      {
        id: 'when',
        header: 'When',
        cell: ({ row }) => {
          const d = new Date(row.original.createdAt);
          return (
            <div className="whitespace-nowrap text-sm">
              <div>{format(d, 'dd MMM yyyy')}</div>
              <div className="text-xs text-muted-foreground">{format(d, 'HH:mm:ss')}</div>
            </div>
          );
        },
      },
      {
        id: 'actor',
        header: 'Actor',
        cell: ({ row }) => {
          const r = row.original;
          if (!r.actorName && !r.actorEmail) {
            return <span className="text-sm text-muted-foreground">System</span>;
          }
          return (
            <EntityCell
              primary={r.actorName ?? 'Unknown'}
              secondary={r.actorEmail}
            />
          );
        },
      },
      {
        id: 'action',
        header: 'Action',
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{formatAuditAction(row.original.action)}</div>
            <div className="truncate text-xs text-muted-foreground">{row.original.action}</div>
          </div>
        ),
      },
      {
        id: 'entity',
        header: 'Entity',
        cell: ({ row }) => (
          <span className="text-sm capitalize">{row.original.entityType.replace(/-/g, ' ')}</span>
        ),
      },
      {
        id: 'entityId',
        header: 'Entity ID',
        cell: ({ row }) => {
          const id = row.original.entityId;
          if (!id) return <span className="text-muted-foreground">—</span>;
          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
              title={id}
              onClick={(e) => {
                e.stopPropagation();
                void navigator.clipboard.writeText(id).then(
                  () => toast.success('Copied entity ID'),
                  () => toast.error('Could not copy'),
                );
              }}
            >
              {truncateId(id)}
              <IconCopy className="h-3.5 w-3.5" />
            </button>
          );
        },
      },
      {
        id: 'ip',
        header: 'IP',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.ipAddress ?? '—'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const items: RowActionItem[] = [
            {
              label: 'Details',
              icon: <IconEye className="h-4 w-4" />,
              onClick: () => setDetail(row.original),
            },
          ];
          return <RowActions items={items} />;
        },
      },
    ];
  }, [list.data?.meta.page, list.data?.meta.pageSize, params.page, params.pageSize]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadActivityLogCsv(queryString);
      toast.success('Export downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  const hasFilters = Boolean(
    params.q ||
      params.extra.dateFrom ||
      params.extra.dateTo ||
      params.extra.actorId ||
      params.extra.entityType,
  );

  return (
    <div className="w-full min-w-0">
      <PageToolbar
        title="Activity log"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Activity log' },
        ]}
        actions={
          <ExportMenu onExportCsv={() => void handleExport()} disabled={exporting} />
        }
      />

      <FilterBar>
        <div className="relative min-w-0 flex-1 basis-56 max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => {
              const q = e.target.value;
              setSearchDraft(q);
              setSearchQueryDebounced(q);
            }}
            placeholder="Search action, user, entity, IP…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <DateFilterPill
          label="From"
          value={parseDateParam(params.extra.dateFrom)}
          onChange={(date) => setParams({ extra: { dateFrom: toDateParam(date) } })}
        />
        <DateFilterPill
          label="To"
          value={parseDateParam(params.extra.dateTo)}
          onChange={(date) => setParams({ extra: { dateTo: toDateParam(date) } })}
        />
        <ChecklistFilter
          label="User"
          icon={<IconUser className="h-4 w-4" />}
          options={userOptions}
          value={params.extra.actorId || undefined}
          onChange={(value) => setParams({ extra: { actorId: value } })}
          searchPlaceholder="Search users"
        />
        <ChecklistFilter
          label="Entity type"
          icon={<IconFilter className="h-4 w-4" />}
          options={[...ACTIVITY_ENTITY_TYPE_OPTIONS]}
          value={params.extra.entityType || undefined}
          onChange={(value) => setParams({ extra: { entityType: value } })}
          searchPlaceholder="Entity types"
        />
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => {
              setSearchDraft('');
              setParams({
                q: '',
                extra: {
                  dateFrom: undefined,
                  dateTo: undefined,
                  actorId: undefined,
                  entityType: undefined,
                },
              });
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </FilterBar>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        error={list.isError ? 'Failed to load activity log' : null}
        onPageChange={(page) => setParams({ page })}
        pageSize={params.pageSize}
        onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
        emptyMessage="No activity recorded"
      />

      <Dialog
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Event details</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Action</div>
                <div className="font-medium">{formatAuditAction(detail.action)}</div>
                <div className="font-mono text-xs text-muted-foreground">{detail.action}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Entity</div>
                  <div>{detail.entityType}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">When</div>
                  <div>{format(new Date(detail.createdAt), 'dd MMM yyyy HH:mm:ss')}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Actor</div>
                  <div>{detail.actorName ?? 'System'}</div>
                  {detail.actorEmail ? (
                    <div className="text-xs text-muted-foreground">{detail.actorEmail}</div>
                  ) : null}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">IP</div>
                  <div className="font-mono text-xs">{detail.ipAddress ?? '—'}</div>
                </div>
              </div>
              {detail.entityId ? (
                <div>
                  <div className="text-xs text-muted-foreground">Entity ID</div>
                  <div className="break-all font-mono text-xs">{detail.entityId}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-muted-foreground">Metadata</div>
                <pre className="mt-1 max-h-48 overflow-auto rounded-md border border-border bg-muted/40 p-2 font-mono text-xs">
                  {detail.metadata ? JSON.stringify(detail.metadata, null, 2) : '—'}
                </pre>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ActivityLogPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <ActivityLogInner />
    </Suspense>
  );
}
