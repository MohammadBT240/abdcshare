'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/data/data-table';
import { useListParams } from '@/components/data/use-list-params';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useClientsList, type ClientRecord } from '@/features/clients/hooks/use-clients';

function ClientsListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const { params, setParams, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const list = useClientsList(queryString);

  const columns = useMemo<ColumnDef<ClientRecord, unknown>[]>(
    () => [
      { header: 'Name', accessorKey: 'name' },
      { header: 'Type', accessorKey: 'clientType' },
      { header: 'Contact', accessorKey: 'primaryContactName' },
      { header: 'Email', accessorKey: 'email' },
      {
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <div>
      <PageToolbar
        title="Clients"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Clients' },
        ]}
        actions={
          can('client:manage') ? (
            <Button type="button" onClick={() => router.push('/admin/clients/new')}>
              <IconPlus className="h-4 w-4" />
              Add Client
            </Button>
          ) : null
        }
      />
      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        search={searchDraft}
        onSearchChange={(q) => {
          setSearchDraft(q);
          setParams({ q });
        }}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(row) => router.push(`/admin/clients/${row.id}`)}
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
