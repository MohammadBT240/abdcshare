'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  IconBuilding,
  IconEye,
  IconGridDots,
  IconList,
  IconSearch,
  IconTag,
  IconUsers,
} from '@tabler/icons-react';
import {
  AvatarStack,
  ChecklistFilter,
  CircularProgress,
  DataTable,
  DateFilterPill,
  DualDateCell,
  EntityCell,
  FilterBar,
  ListPagination,
  RowActions,
  UserAvatar,
  useListParams,
  type RowActionItem,
} from '@/components/data';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuthContext } from '@/components/providers/auth-provider';
import { CreateEngagementDialog } from '@/features/engagements/components/create-engagement-dialog';
import { EngagementCard } from '@/features/engagements/components/engagement-card';
import { EngagementStageBadge } from '@/features/engagements/components/engagement-stage-badge';
import {
  useEngagementFilterOptions,
  useEngagementsList,
  type EngagementListItem,
} from '@/features/engagements/hooks/use-engagements';
import { HelpTip } from '@/features/help/components/help-tip';

function parseDateParam(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toDateParam(date?: Date): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

function EngagementsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canCreate = can('engagement:create');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams({
    pageSize: 10,
  });
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  const list = useEngagementsList(queryString);
  const filterOptions = useEngagementFilterOptions();

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const clientOptions = useMemo(
    () =>
      (filterOptions.data?.clients ?? []).map((c) => ({
        value: c.id,
        label: c.name,
      })),
    [filterOptions.data],
  );

  const departmentOptions = useMemo(
    () =>
      (filterOptions.data?.departments ?? []).map((d) => ({
        value: String(d.id),
        label: d.name,
      })),
    [filterOptions.data],
  );

  const stageOptions = [
    { value: 'Planning', label: 'Planning' },
    { value: 'Execution', label: 'Execution' },
    { value: 'Reporting', label: 'Reporting' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Archived', label: 'Archived' },
  ];

  const columns = useMemo<ColumnDef<EngagementListItem, unknown>[]>(
    () => [
      {
        id: 'client',
        header: 'Client',
        cell: ({ row }) => (
          <div className="flex min-w-[8rem] items-center gap-2">
            <UserAvatar
              initials={row.original.clientName}
              size="sm"
              className="shrink-0"
            />
            <span className="truncate font-medium">{row.original.clientName}</span>
          </div>
        ),
      },
      {
        id: 'project',
        header: 'Engagement',
        cell: ({ row }) => {
          const record = row.original;
          const secondary = [record.referenceCode, record.periodLabel]
            .filter(Boolean)
            .join(' • ');
          return <EntityCell primary={record.title} secondary={secondary} />;
        },
      },
      {
        id: 'collaborators',
        header: 'Collaborators',
        cell: ({ row }) => (
          <AvatarStack
            people={(row.original.teamPreview ?? []).map((m) => ({
              id: m.userId,
              fullName: m.fullName,
              avatarUrl: m.avatarUrl,
            }))}
          />
        ),
      },
      { header: 'Type', accessorKey: 'engagementTypeName' },
      { header: 'Department', accessorKey: 'departmentName' },
      {
        header: 'Stage',
        cell: ({ row }) => <EngagementStageBadge stage={row.original.stage} />,
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => (
          <CircularProgress value={row.original.progressPercent ?? 0} />
        ),
      },
      {
        id: 'dates',
        header: 'Started date',
        cell: ({ row }) => (
          <DualDateCell
            start={row.original.startDate ?? row.original.createdAt}
            deadline={row.original.targetCompletionDate}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const items: RowActionItem[] = [
            {
              label: 'View workspace',
              icon: <IconEye className="h-4 w-4" />,
              onClick: () => router.push(`/engagements/${row.original.id}`),
            },
          ];
          return <RowActions items={items} />;
        },
      },
    ],
    [router],
  );

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Engagements"
        className="mb-2 sm:mb-3"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Engagements' },
        ]}
        actions={
          <>
            <HelpTip slug="engagements-overview" />
            {canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create engagement
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar
        actions={
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as 'table' | 'cards')}
          >
            <ToggleGroupItem value="cards" aria-label="Card view">
              <IconGridDots className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <IconList className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      >
        <div className="relative min-w-0 flex-1 basis-56 max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => {
              setSearchDraft(e.target.value);
              setSearchQueryDebounced(e.target.value);
            }}
            placeholder="Search engagements…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <ChecklistFilter
          label="Client"
          icon={<IconBuilding className="h-4 w-4" />}
          options={clientOptions}
          value={params.extra.clientId || undefined}
          onChange={(value) => setParams({ extra: { clientId: value } })}
          searchPlaceholder="Clients"
        />
        <ChecklistFilter
          label="Department"
          icon={<IconUsers className="h-4 w-4" />}
          options={departmentOptions}
          value={params.extra.departmentId || undefined}
          onChange={(value) => setParams({ extra: { departmentId: value } })}
          searchPlaceholder="Departments"
        />
        <ChecklistFilter
          label="Stage"
          icon={<IconTag className="h-4 w-4" />}
          options={stageOptions}
          value={params.extra.stage || undefined}
          onChange={(value) => setParams({ extra: { stage: value } })}
          searchPlaceholder="Stages"
        />
        <DateFilterPill
          label="Start date"
          value={parseDateParam(params.extra.startDate)}
          onChange={(date) => setParams({ extra: { startDate: toDateParam(date) } })}
        />
        <DateFilterPill
          label="Deadline"
          value={parseDateParam(params.extra.targetDate)}
          onChange={(date) => setParams({ extra: { targetDate: toDateParam(date) } })}
        />
      </FilterBar>

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          meta={list.data?.meta}
          isPending={list.isPending}
          error={list.isError ? 'Failed to load engagements' : null}
          onPageChange={(page) => setParams({ page })}
          pageSize={params.pageSize}
          onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
          onRowClick={(row) => router.push(`/engagements/${row.id}`)}
          emptyMessage="No engagements found"
        />
      ) : (
        <div className="space-y-3">
          {list.isPending && !list.data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list.isError ? (
            <p className="text-sm text-destructive">Failed to load engagements</p>
          ) : (list.data?.data.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
              No engagements found
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.data?.data.map((eng) => (
                <EngagementCard key={eng.id} engagement={eng} />
              ))}
            </div>
          )}
          {list.data?.meta ? (
            <ListPagination
              meta={list.data.meta}
              pageSize={params.pageSize}
              onPageChange={(page) => setParams({ page })}
              onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
              isPending={list.isPending}
            />
          ) : null}
        </div>
      )}

      <CreateEngagementDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => router.push(`/engagements/${id}`)}
      />
    </div>
  );
}

export default function EngagementsListPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <EngagementsListInner />
    </Suspense>
  );
}
