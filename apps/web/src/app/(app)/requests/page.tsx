'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { IconAlertCircle, IconExternalLink, IconHistory } from '@tabler/icons-react';
import {
  DataTable,
  EntityCell,
  FilterBar,
  RowActions,
  snColumn,
  useListParams,
  type RowActionItem,
} from '@/components/data';
import { AppSelect } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserAvatar } from '@/components/data/user-avatar';
import { RequestHistoryDialog } from '@/features/requests/components/request-history-dialog';
import {
  useBulkUpdateRequests,
  useRequestsList,
  type RequestListItem,
} from '@/features/requests/hooks/use-requests';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import { useUsersList } from '@/features/users/hooks/use-users';
import { useAuthContext } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { BffClientError } from '@/lib/bff/client';

function RequestsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canManageLifecycle = can('request:update') && can('catalogue:view');
  const canBulkAssign = can('request:assign') && can('catalogue:view');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [historyRequest, setHistoryRequest] = useState<{ id: string; refCode: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStageId, setBulkStageId] = useState('');
  const [bulkStatusId, setBulkStatusId] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const bulkUpdate = useBulkUpdateRequests();

  const list = useRequestsList(queryString);
  const requestStages = useCatalogueList('request-stages', 'pageSize=100&isActive=true');
  const requestStatuses = useCatalogueList('request-statuses', 'pageSize=100&isActive=true');
  const users = useUsersList('pageSize=100&isActive=true');

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const stageOptions = useMemo(
    () => (requestStages.data?.data ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [requestStages.data],
  );

  const statusOptions = useMemo(
    () => (requestStatuses.data?.data ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [requestStatuses.data],
  );
  const userOptions = useMemo(
    () => (users.data?.data ?? []).map((u) => ({ value: u.id, label: u.fullName })),
    [users.data],
  );

  async function applyBulkUpdate() {
    try {
      const result = await bulkUpdate.mutateAsync({
        ids: selectedIds,
        stageId:
          canManageLifecycle && bulkStageId ? Number(bulkStageId) : undefined,
        statusId:
          canManageLifecycle && bulkStatusId ? Number(bulkStatusId) : undefined,
        assigneeUserId: canBulkAssign ? bulkAssigneeId || undefined : undefined,
      });
      toast.success(`${result.updated} request(s) updated`);
      setSelectedIds([]);
      setBulkStageId('');
      setBulkStatusId('');
      setBulkAssigneeId('');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to update requests');
    }
  }

  const phaseOptions = [
    { value: 'Planning', label: 'Planning' },
    { value: 'Execution', label: 'Execution' },
    { value: 'Reporting', label: 'Reporting' },
  ];

  const columns = useMemo<ColumnDef<RequestListItem, unknown>[]>(() => {
    const page = list.data?.meta.page ?? params.page;
    const pageSize = list.data?.meta.pageSize ?? params.pageSize;

    return [
      snColumn<RequestListItem>(page, pageSize),
      {
        id: 'request',
        header: 'Request',
        cell: ({ row }) => {
          const record = row.original;
          const secondary = [record.requestTypeName, record.description].filter(Boolean).join(' • ');
          return (
            <EntityCell
              primary={record.referenceCode}
              secondary={secondary}
            />
          );
        },
      },
      { header: 'Engagement', accessorKey: 'engagementTitle' },
      { header: 'Class', accessorKey: 'requestClassName' },
      {
        header: 'Phase',
        cell: ({ row }) => <Badge variant="secondary">{row.original.phase}</Badge>,
      },
      { header: 'Stage', accessorKey: 'stage' },
      { header: 'Status', accessorKey: 'status' },
      {
        header: 'Due date',
        cell: ({ row }) => {
          const { dueDate, isOverdue } = row.original;
          if (!dueDate) return '—';
          return (
            <div className="flex items-center gap-1.5">
              {isOverdue ? <IconAlertCircle className="h-4 w-4 text-destructive" /> : null}
              <span className={isOverdue ? 'text-destructive' : ''}>
                {new Date(dueDate).toLocaleDateString()}
              </span>
            </div>
          );
        },
      },
      {
        header: 'Assignees',
        cell: ({ row }) => {
          const { assignees } = row.original;
          if (assignees.length === 0) return '—';
          return (
            <div className="flex -space-x-2">
              {assignees.slice(0, 3).map((a) => (
                <UserAvatar
                  key={a.userId}
                  src={a.avatarUrl}
                  initials={a.fullName.slice(0, 2)}
                  size="sm"
                  className="ring-2 ring-background"
                />
              ))}
              {assignees.length > 3 ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium ring-2 ring-background">
                  +{assignees.length - 3}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const record = row.original;
          const items: RowActionItem[] = [
            {
              label: 'Open',
              icon: <IconExternalLink className="h-4 w-4" />,
              onClick: () => router.push(`/requests/${record.id}`),
            },
            {
              label: 'View history',
              icon: <IconHistory className="h-4 w-4" />,
              onClick: () => setHistoryRequest({ id: record.id, refCode: record.referenceCode }),
            },
          ];
          return <RowActions items={items} />;
        },
      },
    ];
  }, [list.data?.meta, params.page, params.pageSize, router]);

  return (
    <div className="space-y-5">
      <PageToolbar
        title="Requests"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Requests' },
        ]}
        description="Global inbox for all requests across engagements"
      />

      <FilterBar>
        <Input
          value={searchDraft}
          onChange={(e) => {
            setSearchDraft(e.target.value);
            setSearchQueryDebounced(e.target.value);
          }}
          placeholder="Search requests..."
          className="h-9 w-64"
        />
        <AppSelect
          value={params.extra.phase ?? ''}
          onValueChange={(value) => setParams({ extra: { phase: value } })}
          options={[{ value: '', label: 'All phases' }, ...phaseOptions]}
          placeholder="Filter by phase"
          className="h-9 w-48"
        />
        <AppSelect
          value={params.extra.stageId ?? ''}
          onValueChange={(value) => setParams({ extra: { stageId: value } })}
          options={[{ value: '', label: 'All stages' }, ...stageOptions]}
          placeholder="Filter by stage"
          className="h-9 w-48"
        />
        <AppSelect
          value={params.extra.statusId ?? ''}
          onValueChange={(value) => setParams({ extra: { statusId: value } })}
          options={[{ value: '', label: 'All statuses' }, ...statusOptions]}
          placeholder="Filter by status"
          className="h-9 w-48"
        />
      </FilterBar>

      {selectedIds.length > 0 && (canManageLifecycle || canBulkAssign) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="mr-2 text-sm font-medium">{selectedIds.length} selected</span>
          {canManageLifecycle ? (
            <>
              <AppSelect
                value={bulkStageId}
                onValueChange={setBulkStageId}
                options={stageOptions}
                placeholder="Set stage"
                className="w-44"
              />
              <AppSelect
                value={bulkStatusId}
                onValueChange={setBulkStatusId}
                options={statusOptions}
                placeholder="Set status"
                className="w-44"
              />
            </>
          ) : null}
          {canBulkAssign ? (
            <AppSelect
              value={bulkAssigneeId}
              onValueChange={setBulkAssigneeId}
              options={userOptions}
              placeholder="Set assignee"
              className="w-48"
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={
              bulkUpdate.isPending ||
              (!bulkStageId && !bulkStatusId && !bulkAssigneeId) ||
              (!canManageLifecycle && Boolean(bulkStageId || bulkStatusId))
            }
            onClick={applyBulkUpdate}
          >
            {bulkUpdate.isPending ? 'Updating…' : 'Apply'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        error={list.isError ? 'Failed to load requests' : null}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(row) => router.push(`/requests/${row.id}`)}
        emptyMessage="No requests found"
        selectable={canManageLifecycle || canBulkAssign}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        getRowId={(row) => row.id}
      />

      {historyRequest ? (
        <RequestHistoryDialog
          open={Boolean(historyRequest)}
          onOpenChange={(open) => !open && setHistoryRequest(null)}
          requestId={historyRequest.id}
          requestReferenceCode={historyRequest.refCode}
        />
      ) : null}
    </div>
  );
}

export default function RequestsListPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <RequestsListInner />
    </Suspense>
  );
}
