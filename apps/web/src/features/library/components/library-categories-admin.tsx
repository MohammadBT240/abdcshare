'use client';

import { useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data/data-table';
import { StatusBadge } from '@/components/data/status-badge';
import { ConfirmDialog, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useLibraryCategories, useLibraryCategoryMutations } from '@/features/library/hooks/use-library';
import type { LibraryCategory } from '@/features/library/types';

interface FormState {
  name: string;
  description: string;
  sortOrder: string;
}

const EMPTY: FormState = { name: '', description: '', sortOrder: '' };
const FORM_ID = 'library-category-form';

/** Admin › Catalogues › Library categories. Writes need `catalogue:manage` (Platform Admin). */
export function LibraryCategoriesAdmin() {
  const { can } = useAuthContext();
  const canManage = can('catalogue:manage');
  const categories = useLibraryCategories({ includeInactive: canManage });
  const { create, update, setActive } = useLibraryCategoryMutations();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryCategory | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deactivateTarget, setDeactivateTarget] = useState<LibraryCategory | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = categories.data ?? [];
    return q ? all.filter((c) => c.name.toLowerCase().includes(q)) : all;
  }, [categories.data, search]);

  function openForm(category: LibraryCategory | null) {
    setEditing(category);
    setForm(
      category
        ? { name: category.name, description: category.description ?? '', sortOrder: String(category.sortOrder) }
        : EMPTY,
    );
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      ...(form.sortOrder.trim() ? { sortOrder: Number(form.sortOrder) } : {}),
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, body });
        toast.success('Category updated');
      } else {
        await create.mutateAsync(body);
        toast.success('Category added');
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  const columns = useMemo<ColumnDef<LibraryCategory, unknown>[]>(() => {
    const cols: ColumnDef<LibraryCategory, unknown>[] = [
      {
        header: 'Name',
        id: 'name',
        cell: ({ row }) => (
          <div className="min-w-[12rem]">
            <p className="font-medium text-foreground">{row.original.name}</p>
            {row.original.description ? (
              <p className="line-clamp-1 text-xs text-muted-foreground">{row.original.description}</p>
            ) : null}
          </div>
        ),
      },
      { header: 'Slug', accessorKey: 'slug' },
      { header: 'Order', accessorKey: 'sortOrder' },
      { header: 'Status', id: 'status', cell: ({ row }) => <StatusBadge status={row.original.isActive} /> },
    ];
    if (canManage) {
      cols.push({
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button type="button" size="sm" variant="outline" onClick={() => openForm(row.original)}>
              Edit
            </Button>
            {row.original.isActive ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => setDeactivateTarget(row.original)}>
                Deactivate
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await setActive.mutateAsync({ id: row.original.id, active: true });
                    toast.success('Reactivated');
                  } catch (err) {
                    toast.error(err instanceof BffClientError ? err.message : 'Failed');
                  }
                }}
              >
                Reactivate
              </Button>
            )}
          </div>
        ),
      });
    }
    return cols;
  }, [canManage, setActive]);

  const pending = create.isPending || update.isPending;

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold leading-tight text-foreground">Library categories</h2>
          <p className="text-sm text-muted-foreground">
            How items in the staff library are grouped. Deactivating a category hides it from pickers and filters; its
            items stay in the library.
          </p>
        </div>
        {canManage ? (
          <Button type="button" className="h-9 shrink-0" onClick={() => openForm(null)}>
            <IconPlus className="h-4 w-4" /> Add
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isPending={categories.isPending}
        error={categories.isError ? 'Failed to load categories' : null}
        search={search}
        searchPlaceholder="Search categories…"
        onSearchChange={setSearch}
        emptyMessage="No categories yet."
        getRowId={(row) => row.id}
      />

      <FormDialog
        open={open}
        onOpenChange={(next) => !pending && setOpen(next)}
        title={editing ? 'Edit library category' : 'Add library category'}
        maxWidthClass="sm:max-w-md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <LoadingButton type="submit" form={FORM_ID} loading={pending} disabled={!form.name.trim()}>
              Save
            </LoadingButton>
          </>
        }
      >
        <form id={FORM_ID} onSubmit={save} className="space-y-4">
          <FormField label="Name" required htmlFor="library-category-name">
            <Input
              id="library-category-name"
              value={form.name}
              maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>
          <FormField label="Description" htmlFor="library-category-description">
            <Textarea
              id="library-category-description"
              value={form.description}
              maxLength={500}
              rows={3}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </FormField>
          <FormField label="Sort order" htmlFor="library-category-order" hint="Lower numbers appear first.">
            <Input
              id="library-category-order"
              inputMode="numeric"
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value.replace(/[^0-9]/g, '') }))}
            />
          </FormField>
        </form>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(next) => !next && setDeactivateTarget(null)}
        title={`Deactivate ${deactivateTarget?.name ?? 'category'}?`}
        description="It will no longer be offered when uploading or filtering. Existing items keep this category."
        confirmLabel="Deactivate"
        confirming={setActive.isPending}
        onConfirm={async () => {
          if (!deactivateTarget) return;
          try {
            await setActive.mutateAsync({ id: deactivateTarget.id, active: false });
            toast.success('Deactivated');
            setDeactivateTarget(null);
          } catch (err) {
            toast.error(err instanceof BffClientError ? err.message : 'Failed');
          }
        }}
      />
    </div>
  );
}
