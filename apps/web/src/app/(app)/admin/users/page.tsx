'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type ColumnDef } from '@tanstack/react-table';
import {
  IconEye,
  IconKey,
  IconPlus,
  IconSearch,
  IconShield,
  IconToggleLeft,
  IconUserOff,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  ChecklistFilter,
  DataTable,
  EntityCell,
  FilterBar,
  RowActions,
  snColumn,
  StatusBadge,
  useListParams,
  type RowActionItem,
} from '@/components/data';
import { ConfirmDialog } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { DataTableSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthContext } from '@/components/providers/auth-provider';
import { AddUserDialog } from '@/features/users/components/add-user-dialog';
import {
  useDeactivateUser,
  useResetUserPassword,
  useRoles,
  useUsersList,
} from '@/features/users/hooks/use-users';
import { FILTERABLE_ROLE_NAMES } from '@/features/users/schemas/user.schema';
import type { UserRecord } from '@/features/users/types';
import { BffClientError } from '@/lib/bff/client';

function UsersListInner() {
  const router = useRouter();
  const { can } = useAuthContext();
  const canManage = can('user:manage');
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const [addOpen, setAddOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<UserRecord | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const list = useUsersList(queryString);
  const roles = useRoles();
  const deactivate = useDeactivateUser();
  const resetPassword = useResetUserPassword();

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const roleOptions = useMemo(
    () =>
      (roles.data ?? [])
        .filter((r) => (FILTERABLE_ROLE_NAMES as readonly string[]).includes(r.roleName))
        .map((r) => ({ value: String(r.id), label: r.roleName })),
    [roles.data],
  );

  const columns = useMemo<ColumnDef<UserRecord, unknown>[]>(() => {
    const page = list.data?.meta.page ?? params.page;
    const pageSize = list.data?.meta.pageSize ?? params.pageSize;

    return [
      snColumn<UserRecord>(page, pageSize),
      {
        id: 'user',
        header: 'User',
        cell: ({ row }) => {
          const record = row.original;
          return (
            <EntityCell
              primary={record.fullName}
              secondary={record.email}
              avatarUrl={record.avatarUrl}
              initials={`${record.firstName?.[0] ?? ''}${record.surname?.[0] ?? ''}`}
            />
          );
        },
      },
      { header: 'Email', accessorKey: 'email' },
      {
        header: 'Role',
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <div>{row.original.role}</div>
            {row.original.partnerDesignation ? (
              <div className="text-xs text-muted-foreground">
                {row.original.partnerDesignation === 'PrincipalPartner'
                  ? 'Principal Partner'
                  : 'Partner'}
              </div>
            ) : null}
          </div>
        ),
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
              onClick: () => router.push(`/admin/users/${record.id}`),
            },
          ];
          if (canManage && record.isActive) {
            items.push({
              label: 'Reset & email password',
              icon: <IconKey className="h-4 w-4" />,
              onClick: () => setResetTarget(record),
              separatorBefore: true,
            });
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
      toast.success(`${deactivateTarget.fullName} deactivated`);
      setDeactivateTarget(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Deactivate failed');
    }
  }

  async function confirmReset() {
    if (!resetTarget) return;
    try {
      await resetPassword.mutateAsync(resetTarget.id);
      toast.success(`New temporary password emailed to ${resetTarget.email}`);
      setResetTarget(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Password reset failed');
    }
  }

  return (
    <div className="w-full min-w-0">
      <PageToolbar
        title="Users"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Admin' },
          { label: 'Users' },
        ]}
        actions={
          canManage ? (
            <Button type="button" size="sm" onClick={() => setAddOpen(true)}>
              <IconPlus className="h-4 w-4" />
              Add User
            </Button>
          ) : null
        }
      />
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />

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
            placeholder="Search users…"
            className="h-10 rounded-lg pl-9"
          />
        </div>
        <ChecklistFilter
          label="Role"
          icon={<IconShield className="h-4 w-4" />}
          options={roleOptions}
          value={params.extra.roleId || undefined}
          onChange={(value) => setParams({ extra: { roleId: value } })}
          searchPlaceholder="Roles"
        />
        <ChecklistFilter
          label="Status"
          icon={<IconToggleLeft className="h-4 w-4" />}
          options={[
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          value={params.extra.isActive || undefined}
          onChange={(value) => setParams({ extra: { isActive: value } })}
          searchPlaceholder="Status"
        />
      </FilterBar>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        onPageChange={(page) => setParams({ page })}
        pageSize={params.pageSize}
        onPageSizeChange={(pageSize) => setParams({ pageSize, page: 1 })}
        onRowClick={(row) => router.push(`/admin/users/${row.id}`)}
        emptyMessage="No users found"
      />

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
        title="Deactivate user?"
        description={`${deactivateTarget?.fullName ?? 'This user'} will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        variant="destructive"
        confirming={deactivate.isPending}
        onConfirm={() => void confirmDeactivate()}
      />

      <ConfirmDialog
        open={Boolean(resetTarget)}
        onOpenChange={(open) => {
          if (!open) setResetTarget(null);
        }}
        title="Reset password and email credentials?"
        description={`A new temporary password will be emailed to ${resetTarget?.email ?? 'this user'}. They must change it on next login. Active sessions will be signed out.`}
        confirmLabel="Reset & email"
        confirming={resetPassword.isPending}
        onConfirm={() => void confirmReset()}
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
