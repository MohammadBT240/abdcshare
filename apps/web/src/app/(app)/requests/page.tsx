'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBriefcase,
  IconBuilding,
  IconSearch,
  IconTag,
  IconUser,
} from '@tabler/icons-react';
import {
  ChecklistFilter,
  DateFilterPill,
  FilterBar,
  useListParams,
} from '@/components/data';
import { AppSelect } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RequestHistoryDialog } from '@/features/requests/components/request-history-dialog';
import { RequestsGroupedTable } from '@/features/requests/components/requests-grouped-table';
import {
  useBulkUpdateRequests,
  useRequestsList,
} from '@/features/requests/hooks/use-requests';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import { useClientsList } from '@/features/clients/hooks/use-clients';
import { useEngagementsList } from '@/features/engagements/hooks/use-engagements';
import { useUsersList } from '@/features/users/hooks/use-users';
import { useAuthContext } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { BffClientError } from '@/lib/bff/client';

function parseDateParam(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateParam(date?: Date): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function parseCsvIds(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function setCsvExtra(key: string, values: string[]) {
  return { extra: { [key]: values.length > 0 ? values.join(',') : undefined } };
}

function RequestsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canManageLifecycle = can('request:update') && can('catalogue:view');
  const canBulkAssign = can('request:assign') && can('catalogue:view');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams({
    pageSize: 50,
  });
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [historyRequest, setHistoryRequest] = useState<{ id: string; refCode: string } | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatusId, setBulkStatusId] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const bulkUpdate = useBulkUpdateRequests();

  const list = useRequestsList(queryString);
  const clients = useClientsList('pageSize=100&isActive=true');
  const engagements = useEngagementsList('pageSize=100');
  const requestClasses = useCatalogueList('request-classes', 'pageSize=100&isActive=true');
  const requestStages = useCatalogueList('request-stages', 'pageSize=100&isActive=true');
  const requestStatuses = useCatalogueList('request-statuses', 'pageSize=100&isActive=true');
  const users = useUsersList('pageSize=100&isActive=true');

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const clientOptions = useMemo(
    () => (clients.data?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clients.data],
  );

  const engagementOptions = useMemo(
    () =>
      (engagements.data?.data ?? []).map((e) => ({
        value: e.id,
        label: e.title,
      })),
    [engagements.data],
  );

  const classOptions = useMemo(
    () => (requestClasses.data?.data ?? []).map((c) => ({ value: String(c.id), label: c.name })),
    [requestClasses.data],
  );

  const stageOptions = useMemo(
    () => (requestStages.data?.data ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [requestStages.data],
  );

  const statusOptions = useMemo(
    () => (requestStatuses.data?.data ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    [requestStatuses.data],
  );

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

  const phaseOptions = [
    { value: 'Planning', label: 'Planning' },
    { value: 'Execution', label: 'Execution' },
    { value: 'Reporting', label: 'Reporting' },
  ];

  const selectedClientIds = parseCsvIds(params.extra.clientIds);
  const selectedEngagementIds = parseCsvIds(
    params.extra.engagementIds || params.extra.engagementId,
  );
  const selectedClassIds = parseCsvIds(
    params.extra.requestClassIds || params.extra.requestClassId,
  );
  const selectedPhases = parseCsvIds(params.extra.phases || params.extra.phase);
  const selectedStageIds = parseCsvIds(params.extra.stageIds || params.extra.stageId);
  const selectedStatusIds = parseCsvIds(params.extra.statusIds || params.extra.statusId);
  const selectedAssigneeIds = parseCsvIds(
    params.extra.assigneeIds || params.extra.assigneeId,
  );

  async function applyBulkUpdate() {
    try {
      const result = await bulkUpdate.mutateAsync({
        ids: selectedIds,
        statusId: canManageLifecycle && bulkStatusId ? Number(bulkStatusId) : undefined,
        assigneeUserId: canBulkAssign ? bulkAssigneeId || undefined : undefined,
      });
      toast.success(`${result.updated} request(s) updated`);
      setSelectedIds([]);
      setBulkStatusId('');
      setBulkAssigneeId('');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to update requests');
    }
  }

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Requests"
        className="mb-2 sm:mb-3"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Requests' },
        ]}
        description="Global inbox for all requests across engagements"
      />

      <FilterBar>
        <div className="relative min-w-0 flex-1 basis-56 max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => {
              setSearchDraft(e.target.value);
              setSearchQueryDebounced(e.target.value);
            }}
            placeholder="Search clients, engagements, requests…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <ChecklistFilter
          label="Client"
          icon={<IconBuilding className="h-4 w-4" />}
          options={clientOptions}
          values={selectedClientIds}
          onValuesChange={(values) => setParams(setCsvExtra('clientIds', values))}
          searchPlaceholder="Clients"
        />
        <ChecklistFilter
          label="Engagement"
          icon={<IconBriefcase className="h-4 w-4" />}
          options={engagementOptions}
          values={selectedEngagementIds}
          onValuesChange={(values) =>
            setParams({
              extra: {
                engagementIds: values.length > 0 ? values.join(',') : undefined,
                engagementId: undefined,
              },
            })
          }
          searchPlaceholder="Engagements"
        />
        <ChecklistFilter
          label="Class"
          icon={<IconTag className="h-4 w-4" />}
          options={classOptions}
          values={selectedClassIds}
          onValuesChange={(values) =>
            setParams({
              extra: {
                requestClassIds: values.length > 0 ? values.join(',') : undefined,
                requestClassId: undefined,
              },
            })
          }
          searchPlaceholder="Classes"
        />
        <ChecklistFilter
          label="Phase"
          icon={<IconTag className="h-4 w-4" />}
          options={phaseOptions}
          values={selectedPhases}
          onValuesChange={(values) =>
            setParams({
              extra: {
                phases: values.length > 0 ? values.join(',') : undefined,
                phase: undefined,
              },
            })
          }
          searchPlaceholder="Phases"
        />
        <ChecklistFilter
          label="Stage"
          icon={<IconTag className="h-4 w-4" />}
          options={stageOptions}
          values={selectedStageIds}
          onValuesChange={(values) =>
            setParams({
              extra: {
                stageIds: values.length > 0 ? values.join(',') : undefined,
                stageId: undefined,
              },
            })
          }
          searchPlaceholder="Stages"
        />
        <ChecklistFilter
          label="Status"
          icon={<IconTag className="h-4 w-4" />}
          options={statusOptions}
          values={selectedStatusIds}
          onValuesChange={(values) =>
            setParams({
              extra: {
                statusIds: values.length > 0 ? values.join(',') : undefined,
                statusId: undefined,
              },
            })
          }
          searchPlaceholder="Statuses"
        />
        <ChecklistFilter
          label="Assignee"
          icon={<IconUser className="h-4 w-4" />}
          options={userOptions}
          values={selectedAssigneeIds}
          onValuesChange={(values) =>
            setParams({
              extra: {
                assigneeIds: values.length > 0 ? values.join(',') : undefined,
                assigneeId: undefined,
              },
            })
          }
          searchPlaceholder="People"
        />
        <DateFilterPill
          label="Due date"
          value={parseDateParam(params.extra.dueDate)}
          onChange={(date) => setParams({ extra: { dueDate: toDateParam(date) } })}
        />
      </FilterBar>

      {selectedIds.length > 0 && (canManageLifecycle || canBulkAssign) ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
          <span className="mr-2 text-sm font-medium">{selectedIds.length} selected</span>
          {canManageLifecycle ? (
            <AppSelect
              value={bulkStatusId}
              onValueChange={setBulkStatusId}
              options={statusOptions}
              placeholder="Set status"
              className="w-44"
            />
          ) : null}
          {canBulkAssign ? (
            <AppSelect
              value={bulkAssigneeId}
              onValueChange={setBulkAssigneeId}
              options={userOptions.map(({ value, label }) => ({ value, label }))}
              placeholder="Set assignee"
              className="w-48"
            />
          ) : null}
          <Button
            type="button"
            size="sm"
            disabled={
              bulkUpdate.isPending ||
              (!bulkStatusId && !bulkAssigneeId) ||
              (!canManageLifecycle && Boolean(bulkStatusId))
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

      <RequestsGroupedTable
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        error={list.isError ? 'Failed to load requests' : null}
        onPageChange={(page) => setParams({ page })}
        pageSize={params.pageSize}
        onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
        onRowClick={(row) => router.push(`/requests/${row.id}`)}
        onViewHistory={(row) =>
          setHistoryRequest({ id: row.id, refCode: row.referenceCode })
        }
        emptyMessage="No requests found"
        selectable={canManageLifecycle || canBulkAssign}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
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
