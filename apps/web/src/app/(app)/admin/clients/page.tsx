'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { IconEye, IconPlus, IconUserOff } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  DataTable,
  EntityCell,
  FilterBar,
  RowActions,
  snColumn,
  StatusBadge,
  useListParams,
  type RowActionItem,
} from '@/components/data';
import { AppSelect, ConfirmDialog } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthContext } from '@/components/providers/auth-provider';
import { AddClientDialog } from '@/features/clients/components/add-client-dialog';
import {
  useClientsList,
  useDeactivateClient,
  type ClientRecord,
} from '@/features/clients/hooks/use-clients';
import { useLookup } from '@/features/users/hooks/use-users';
import { BffClientError } from '@/lib/bff/client';

function ClientsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canManage = can('client:manage');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<ClientRecord | null>(null);
  const list = useClientsList(queryString);
  const clientTypes = useLookup('client-types');
  const deactivate = useDeactivateClient();

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const typeOptions = useMemo(
    () =>
      (clientTypes.data ?? []).map((t) => ({ value: String(t.id), label: t.name })),
    [clientTypes.data],
  );

  const columns = useMemo<ColumnDef<ClientRecord, unknown>[]>(() => {
    const page = list.data?.meta.page ?? params.page;
    const pageSize = list.data?.meta.pageSize ?? params.pageSize;

    return [
      snColumn<ClientRecord>(page, pageSize),
      {
        id: 'client',
        header: 'Client',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <EntityCell
              primary={record.name}
              secondary={record.primaryContactName}
              avatarUrl={record.primaryContactAvatarUrl}
              initials={`${record.primaryContactFirstName?.[0] ?? ''}${record.primaryContactSurname?.[0] ?? ''}`}
            />
          );
        },
      },
      { header: 'Type', accessorKey: 'clientType' },
      {
        header: 'Email',
        cell: ({ row }) =>
          row.original.primaryContactEmail ?? row.original.email ?? '—',
      },
      {
        header: 'Status',
        cell: ({ row }) => <StatusBadge status={row.original.isActive} />,
      },
      {
        header: 'Created',
        cell: ({ row }) =>
          row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : '—',
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const record = row.original;
          const items: RowActionItem[] = [
            {
              label: canManage ? 'View / Edit' : 'View',
              icon: <IconEye className="h-4 w-4" />,
              onClick: () => router.push(`/admin/clients/${record.id}`),
            },
          ];
          if (canManage && record.isActive) {
            items.push({
              label: 'Deactivate',
              icon: <IconUserOff className="h-4 w-4" />,
              onClick: () => setDeactivateTarget(record),
              destructive: true,
              separatorBefore: true,
            });
          }
          return <RowActions items={items} />;
        },
      },
    ];
  }, [canManage, list.data?.meta.page, list.data?.meta.pageSize, params.page, params.pageSize, router]);

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      await deactivate.mutateAsync(deactivateTarget.id);
      toast.success('Client deactivated');
      setDeactivateTarget(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Deactivate failed');
    }
  }

  return (
    <div className="w-full min-w-0">
      <PageToolbar
        title="Clients"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Clients' },
        ]}
        actions={
          canManage ? (
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <IconPlus className="h-4 w-4" />
              Add Client
            </Button>
          ) : null
        }
      />
      <AddClientDialog open={addOpen} onOpenChange={setAddOpen} />

      <FilterBar>
        <AppSelect
          size="sm"
          className="w-[9.5rem] sm:w-44"
          triggerClassName="h-9"
          value={params.extra.clientTypeId ?? 'all'}
          onValueChange={(v) =>
            setParams({ extra: { clientTypeId: v === 'all' ? undefined : v } })
          }
          options={[{ value: 'all', label: 'All types' }, ...typeOptions]}
          placeholder="Type"
          isLoading={clientTypes.isPending}
        />
        <AppSelect
          size="sm"
          className="w-[9.5rem] sm:w-40"
          triggerClassName="h-9"
          value={params.extra.isActive ?? 'all'}
          onValueChange={(v) => setParams({ extra: { isActive: v === 'all' ? undefined : v } })}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          placeholder="Status"
        />
        <Input
          value={searchDraft}
          onChange={(e) => {
            const q = e.target.value;
            setSearchDraft(q);
            setSearchQueryDebounced(q);
          }}
          placeholder="Search clients…"
          className="h-9 min-w-[10rem] flex-1 basis-40 sm:max-w-xs"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(row) => router.push(`/admin/clients/${row.id}`)}
        emptyMessage="No clients found"
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Deactivate client?"
        description={`${deactivateTarget?.name ?? 'This client'} will be marked inactive.`}
        confirmLabel="Deactivate"
        variant="destructive"
        confirming={deactivate.isPending}
        onConfirm={() => void confirmDeactivate()}
      />
    </div>
  );
}

export default function ClientsPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <ClientsListInner />
    </Suspense>
  );
}
