'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { DataTable } from '@/components/data/data-table';
import { useListParams } from '@/components/data/use-list-params';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthContext } from '@/components/providers/auth-provider';
import { useRoles, useUsersList } from '@/features/users/hooks/use-users';
import type { UserRecord } from '@/features/users/types';

function UsersListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const { params, setParams, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const list = useUsersList(queryString);
  const roles = useRoles();

  const columns = useMemo<ColumnDef<UserRecord, unknown>[]>(
    () => [
      { header: 'Name', accessorKey: 'fullName' },
      { header: 'Email', accessorKey: 'email' },
      { header: 'Role', accessorKey: 'role' },
      {
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
            {row.original.isActive ? 'Active' : 'Inactive'}
          </Badge>
        ),
      },
      {
        header: 'Created',
        cell: ({ row }) =>
          row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : '—',
      },
    ],
    [],
  );

  return (
    <div>
      <PageToolbar
        title="Users"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Users' },
        ]}
        actions={
          can('user:manage') ? (
            <Button type="button" onClick={() => router.push('/admin/users/new')}>
              <IconPlus className="h-4 w-4" />
              Add User
            </Button>
          ) : null
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <Select
          value={params.extra.roleId ?? 'all'}
          onValueChange={(v) =>
            setParams({ extra: { roleId: v === 'all' ? undefined : v } })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {(roles.data ?? []).map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.roleName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={params.extra.isActive ?? 'all'}
          onValueChange={(v) => setParams({ extra: { isActive: v === 'all' ? undefined : v } })}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        search={searchDraft}
        searchPlaceholder="Search users…"
        onSearchChange={(q) => {
          setSearchDraft(q);
          setParams({ q });
        }}
        onPageChange={(page) => setParams({ page })}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        emptyMessage="No users found"
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <UsersListInner />
    </Suspense>
  );
}
