'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { DataTable } from '@/components/data/data-table';
import { useListParams } from '@/components/data/use-list-params';
import { DataTableSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { BffClientError } from '@/lib/bff/client';
import {
  useCatalogueList,
  useCatalogueMutations,
  type CatalogueRow,
} from '@/features/catalogues/hooks/use-catalogue';

type FieldKey = 'name' | 'code' | 'description' | 'sortOrder' | 'expectedDocuments' | 'requestClassId';

interface CatalogueAdminPageProps {
  title: string;
  description?: string;
  resource: string;
  managePermission?: 'catalogue:manage' | 'department:manage';
  fields?: FieldKey[];
  requestClasses?: CatalogueRow[];
  /** When true, show "Allowed classes" action (engagement types only). */
  allowRequestClassMapping?: boolean;
}

export function CatalogueAdminPage({
  title,
  description,
  resource,
  managePermission = 'catalogue:manage',
  fields = ['name'],
  requestClasses,
  allowRequestClassMapping = false,
}: CatalogueAdminPageProps) {
  return (
    <Suspense fallback={<DataTableSkeleton />}>
      <CatalogueAdminInner
        title={title}
        description={description}
        resource={resource}
        managePermission={managePermission}
        fields={fields}
        requestClasses={requestClasses}
        allowRequestClassMapping={allowRequestClassMapping}
      />
    </Suspense>
  );
}

function CatalogueAdminInner({
  title,
  description,
  resource,
  managePermission = 'catalogue:manage',
  fields = ['name'],
  requestClasses,
  allowRequestClassMapping = false,
}: CatalogueAdminPageProps) {
  const fieldList = fields ?? ['name'];
  const { can } = useAuthContext();
  const canManage = can(managePermission!);
  const { params, setParams, setSearchQueryDebounced, queryString } = useListParams();
  const [searchDraft, setSearchDraft] = useState(params.q);
  const list = useCatalogueList(resource, queryString);
  const mutations = useCatalogueMutations(resource);

  useEffect(() => {
    setSearchDraft(params.q);
  }, [params.q]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogueRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ name: '' });
  const [classesOpen, setClassesOpen] = useState(false);
  const [classesTarget, setClassesTarget] = useState<CatalogueRow | null>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);

  const columns = useMemo<ColumnDef<CatalogueRow, unknown>[]>(() => {
    const cols: ColumnDef<CatalogueRow, unknown>[] = [{ header: 'Name', accessorKey: 'name' }];
    if (fieldList.includes('code')) cols.push({ header: 'Code', accessorKey: 'code' });
    if (fieldList.includes('sortOrder')) cols.push({ header: 'Order', accessorKey: 'sortOrder' });
    if (fieldList.includes('expectedDocuments')) {
      cols.push({ header: 'Expected docs', accessorKey: 'expectedDocuments' });
    }
    if (fieldList.includes('requestClassId')) {
      cols.push({
        header: 'Class',
        cell: ({ row }) => row.original.requestClassName ?? row.original.requestClassId ?? '—',
      });
    }
    cols.push({
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.isActive ? 'success' : 'secondary'}>
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    });
    if (canManage) {
      cols.push({
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditing(row.original);
                setForm({
                  name: row.original.name,
                  code: row.original.code ?? '',
                  description: row.original.description ?? '',
                  sortOrder: String(row.original.sortOrder ?? ''),
                  expectedDocuments: String(row.original.expectedDocuments ?? '1'),
                  requestClassId: String(row.original.requestClassId ?? ''),
                });
                setOpen(true);
              }}
            >
              Edit
            </Button>
            {allowRequestClassMapping ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setClassesTarget(row.original);
                  setSelectedClassIds(row.original.suggestedRequestClassIds ?? []);
                  setClassesOpen(true);
                }}
              >
                Suggested classes
              </Button>
            ) : null}
            {row.original.isActive ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="ghost">
                    Deactivate
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deactivate {row.original.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This item will be marked inactive and hidden from default lists.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await mutations.deactivate.mutateAsync(row.original.id);
                          toast.success('Deactivated');
                        } catch (err) {
                          toast.error(err instanceof BffClientError ? err.message : 'Failed');
                        }
                      }}
                    >
                      Deactivate
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        ),
      });
    }
    return cols;
  }, [fieldList, canManage, allowRequestClassMapping, mutations.deactivate]);

  async function save() {
    try {
      const body: Record<string, unknown> = { name: form.name };
      if (fieldList.includes('code') && form.code) body.code = form.code;
      if (fieldList.includes('description')) body.description = form.description || undefined;
      if (fieldList.includes('sortOrder') && form.sortOrder) body.sortOrder = Number(form.sortOrder);
      if (fieldList.includes('expectedDocuments') && form.expectedDocuments) {
        body.expectedDocuments = Number(form.expectedDocuments);
      }
      if (fieldList.includes('requestClassId') && form.requestClassId) {
        body.requestClassId = Number(form.requestClassId);
      }

      if (editing) {
        await mutations.update.mutateAsync({ id: editing.id, body });
        toast.success('Updated');
      } else {
        await mutations.create.mutateAsync(body);
        toast.success('Created');
      }
      setOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold leading-tight text-foreground">{title}</h2>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {canManage ? (
          <Button
            type="button"
            className="h-9 shrink-0"
            onClick={() => {
              setEditing(null);
              setForm({
                name: '',
                code: '',
                description: '',
                sortOrder: '',
                expectedDocuments: '1',
                requestClassId: requestClasses?.[0] ? String(requestClasses[0].id) : '',
              });
              setOpen(true);
            }}
          >
            <IconPlus className="h-4 w-4" />
            Add
          </Button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={list.data?.data ?? []}
        meta={list.data?.meta}
        isPending={list.isPending}
        search={searchDraft}
        onSearchChange={(q) => {
          setSearchDraft(q);
          setSearchQueryDebounced(q);
        }}
        onPageChange={(page) => setParams({ page })}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${title}` : `Add ${title}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            {fieldList.includes('code') ? (
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code ?? ''} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
            ) : null}
            {fieldList.includes('description') ? (
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={form.description ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            ) : null}
            {fieldList.includes('sortOrder') ? (
              <div className="space-y-2">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sortOrder ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                />
              </div>
            ) : null}
            {fieldList.includes('expectedDocuments') ? (
              <div className="space-y-2">
                <Label>Expected documents</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.expectedDocuments ?? '1'}
                  onChange={(e) => setForm((f) => ({ ...f, expectedDocuments: e.target.value }))}
                />
              </div>
            ) : null}
            {fieldList.includes('requestClassId') && requestClasses ? (
              <div className="space-y-2">
                <Label>Request class</Label>
                <select
                  className="flex h-11 w-full rounded-md border border-input bg-primary/5 px-3 text-sm"
                  value={form.requestClassId ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, requestClassId: e.target.value }))}
                >
                  {requestClasses.map((rc) => (
                    <option key={rc.id} value={rc.id}>
                      {rc.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void save()} disabled={!form.name}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={classesOpen} onOpenChange={setClassesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Suggested request classes{classesTarget ? ` — ${classesTarget.name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Soft defaults when creating an engagement of this type. Any active class can still be
            added on an engagement — leave none selected for no suggestions.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(requestClasses ?? []).map((rc) => {
              const checked = selectedClassIds.includes(rc.id);
              return (
                <label key={rc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setSelectedClassIds((ids) =>
                        checked ? ids.filter((id) => id !== rc.id) : [...ids, rc.id],
                      )
                    }
                  />
                  {rc.name}
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClassesOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!classesTarget) return;
                try {
                  await mutations.setAllowedRequestClasses.mutateAsync({
                    id: classesTarget.id,
                    requestClassIds: selectedClassIds,
                  });
                  toast.success(
                    selectedClassIds.length === 0
                      ? 'No suggested classes (any class can still be added on an engagement)'
                      : 'Suggested request classes updated',
                  );
                  setClassesOpen(false);
                } catch (err) {
                  toast.error(err instanceof BffClientError ? err.message : 'Update failed');
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
