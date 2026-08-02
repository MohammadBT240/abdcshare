'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { IconEye, IconGridDots, IconList } from '@tabler/icons-react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useAuthContext } from '@/components/providers/auth-provider';
import { CreateEngagementDialog } from '@/features/engagements/components/create-engagement-dialog';
import { EngagementCard } from '@/features/engagements/components/engagement-card';
import { EngagementStageBadge } from '@/features/engagements/components/engagement-stage-badge';
import {
  useEngagementsList,
  type EngagementListItem,
} from '@/features/engagements/hooks/use-engagements';
import { useClientsList } from '@/features/clients/hooks/use-clients';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';

function EngagementsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canCreate = can('engagement:create');
  const canUpdate = can('engagement:update');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  const list = useEngagementsList(queryString);
  const clients = useClientsList('pageSize=100&isActive=true');
  const departments = useCatalogueList('departments', 'pageSize=100&isActive=true');

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const clientOptions = useMemo(
    () => (clients.data?.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [clients.data],
  );

  const departmentOptions = useMemo(
    () => (departments.data?.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
    [departments.data],
  );

  const stageOptions = [
    { value: 'Planning', label: 'Planning' },
    { value: 'Execution', label: 'Execution' },
    { value: 'Reporting', label: 'Reporting' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Archived', label: 'Archived' },
  ];

  const columns = useMemo<ColumnDef<EngagementListItem, unknown>[]>(() => {
    const page = list.data?.meta.page ?? params.page;
    const pageSize = list.data?.meta.pageSize ?? params.pageSize;

    return [
      snColumn<EngagementListItem>(page, pageSize),
      {
        id: 'engagement',
        header: 'Engagement',
        cell: ({ row }) => {
          const record = row.original;
          const secondary = [record.referenceCode, record.periodLabel].filter(Boolean).join(' • ');
          return (
            <EntityCell
              primary={record.title}
              secondary={secondary}
            />
          );
        },
      },
      { header: 'Client', accessorKey: 'clientName' },
      { header: 'Type', accessorKey: 'engagementTypeName' },
      { header: 'Department', accessorKey: 'departmentName' },
      {
        header: 'Stage',
        cell: ({ row }) => <EngagementStageBadge stage={row.original.stage} />,
      },
      {
        header: 'Requests',
        cell: ({ row }) => {
          const { requestCount, overdueCount } = row.original;
          return (
            <span>
              {requestCount}
              {overdueCount > 0 ? ` (${overdueCount} overdue)` : ''}
            </span>
          );
        },
      },
      {
        header: 'Team',
        accessorKey: 'teamSize',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const record = row.original;
          const items: RowActionItem[] = [
            {
              label: 'View workspace',
              icon: IconEye as any,
              onClick: () => router.push(`/engagements/${record.id}`),
            },
          ];
          return <RowActions items={items} />;
        },
      },
    ];
  }, [list.data?.meta, params.page, params.pageSize, router]);

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
          canCreate ? (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create engagement
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <Input
          value={searchDraft}
          onChange={(e) => {
            setSearchDraft(e.target.value);
            setSearchQueryDebounced(e.target.value);
          }}
          placeholder="Search engagements..."
          className="h-9 w-64"
        />
        <AppSelect
          value={params.extra.clientId ?? ''}
          onValueChange={(value) => setParams({ extra: { clientId: value } })}
          options={[{ value: '', label: 'All clients' }, ...clientOptions]}
          placeholder="Filter by client"
          className="h-9 w-48"
        />
        <AppSelect
          value={params.extra.stage ?? ''}
          onValueChange={(value) => setParams({ extra: { stage: value } })}
          options={[{ value: '', label: 'All stages' }, ...stageOptions]}
          placeholder="Filter by stage"
          className="h-9 w-48"
        />
        <AppSelect
          value={params.extra.departmentId ?? ''}
          onValueChange={(value) => setParams({ extra: { departmentId: value } })}
          options={[{ value: '', label: 'All departments' }, ...departmentOptions]}
          placeholder="Filter by department"
          className="h-9 w-48"
        />
        <div className="ml-auto">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'table' | 'cards')}>
            <ToggleGroupItem value="cards" aria-label="Card view">
              <IconGridDots className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view">
              <IconList className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </FilterBar>

      {viewMode === 'table' ? (
        <DataTable
          columns={columns}
          data={list.data?.data ?? []}
          meta={list.data?.meta}
          isPending={list.isPending}
          error={list.isError ? 'Failed to load engagements' : null}
          onPageChange={(page) => setParams({ page })}
          emptyMessage="No engagements found"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
          {list.isPending ? (
            <p className="col-span-full text-sm text-muted-foreground">Loading...</p>
          ) : list.isError ? (
            <p className="col-span-full text-sm text-destructive">Failed to load engagements</p>
          ) : list.data?.data.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">No engagements found</p>
          ) : (
            list.data?.data.map((eng) => <EngagementCard key={eng.id} engagement={eng} />)
          )}
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
