'use client';

import { useMemo, useState } from 'react';
import { IconPlus, IconSearch } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { PageMeta } from '@abdcshare/api-client';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { RequestClassesTypesTable } from '@/features/catalogues/components/request-classes-types-table';
import { getCatalogueSection } from '@/features/catalogues/catalogue-sections';
import {
  useCatalogueList,
  useCatalogueMutations,
  type CatalogueRow,
} from '@/features/catalogues/hooks/use-catalogue';
import {
  filterClassTypeGroups,
  groupRequestClassesWithTypes,
} from '@/features/catalogues/lib/group-request-classes-types';
import { BffClientError } from '@/lib/bff/client';

const HREF = '/admin/catalogues/request-classes';
/** Catalogues are small; load up to 100 of each for client-side grouping. */
const LIST_QS = 'page=1&pageSize=100';

type ClassForm = { name: string; code: string; description: string };
type TypeForm = { name: string; expectedDocuments: string; requestClassId: string };
type DeactivateTarget =
  | { kind: 'class'; row: CatalogueRow }
  | { kind: 'type'; row: CatalogueRow }
  | null;

export default function RequestClassesPage() {
  const section = getCatalogueSection(HREF)!;
  const { can } = useAuthContext();
  const canManage = can('catalogue:manage');

  const classesQuery = useCatalogueList('request-classes', LIST_QS);
  const typesQuery = useCatalogueList('request-types', LIST_QS);
  const classMutations = useCatalogueMutations('request-classes');
  const typeMutations = useCatalogueMutations('request-types');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [classOpen, setClassOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<CatalogueRow | null>(null);
  const [classForm, setClassForm] = useState<ClassForm>({
    name: '',
    code: '',
    description: '',
  });

  const [typeOpen, setTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<CatalogueRow | null>(null);
  const [typeForm, setTypeForm] = useState<TypeForm>({
    name: '',
    expectedDocuments: '1',
    requestClassId: '',
  });
  const [typeClassLocked, setTypeClassLocked] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<DeactivateTarget>(null);

  const allGroups = useMemo(
    () =>
      groupRequestClassesWithTypes(
        classesQuery.data?.data ?? [],
        typesQuery.data?.data ?? [],
      ),
    [classesQuery.data?.data, typesQuery.data?.data],
  );

  const filteredGroups = useMemo(
    () => filterClassTypeGroups(allGroups, search),
    [allGroups, search],
  );

  const forceExpandedIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [] as number[];
    return filteredGroups
      .filter((g) => {
        const classMatch =
          g.class.name.toLowerCase().includes(q) ||
          (g.class.code?.toLowerCase().includes(q) ?? false);
        if (classMatch) return false;
        return g.types.some((t) => t.name.toLowerCase().includes(q));
      })
      .map((g) => g.class.id);
  }, [filteredGroups, search]);

  const total = filteredGroups.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(page, totalPages);
  const pageGroups = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, safePage, pageSize]);

  const meta: PageMeta = {
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  };

  const isPending = classesQuery.isPending || typesQuery.isPending;
  const error =
    (classesQuery.error instanceof Error && classesQuery.error.message) ||
    (typesQuery.error instanceof Error && typesQuery.error.message) ||
    null;

  const realClasses = useMemo(
    () => (classesQuery.data?.data ?? []).filter((c) => c.isActive),
    [classesQuery.data?.data],
  );

  function openAddClass() {
    setEditingClass(null);
    setClassForm({ name: '', code: '', description: '' });
    setClassOpen(true);
  }

  function openEditClass(row: CatalogueRow) {
    setEditingClass(row);
    setClassForm({
      name: row.name,
      code: row.code ?? '',
      description: row.description ?? '',
    });
    setClassOpen(true);
  }

  function openAddType(classRow: CatalogueRow) {
    setEditingType(null);
    setTypeClassLocked(true);
    setTypeForm({
      name: '',
      expectedDocuments: '1',
      requestClassId: String(classRow.id),
    });
    setTypeOpen(true);
  }

  function openEditType(row: CatalogueRow) {
    setEditingType(row);
    setTypeClassLocked(false);
    setTypeForm({
      name: row.name,
      expectedDocuments: String(row.expectedDocuments ?? 1),
      requestClassId: String(row.requestClassId ?? ''),
    });
    setTypeOpen(true);
  }

  async function saveClass() {
    try {
      const body: Record<string, unknown> = {
        name: classForm.name.trim(),
        code: classForm.code.trim() || undefined,
        description: classForm.description.trim() || undefined,
      };
      if (editingClass) {
        await classMutations.update.mutateAsync({ id: editingClass.id, body });
        toast.success('Class updated');
      } else {
        await classMutations.create.mutateAsync(body);
        toast.success('Class created');
      }
      setClassOpen(false);
      setEditingClass(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  async function saveType() {
    try {
      const body: Record<string, unknown> = {
        name: typeForm.name.trim(),
        expectedDocuments: Number(typeForm.expectedDocuments) || 1,
        requestClassId: Number(typeForm.requestClassId),
      };
      if (!body.requestClassId || Number.isNaN(body.requestClassId as number)) {
        toast.error('Request class is required');
        return;
      }
      if (editingType) {
        await typeMutations.update.mutateAsync({ id: editingType.id, body });
        toast.success('Type updated');
      } else {
        await typeMutations.create.mutateAsync(body);
        toast.success('Type created');
      }
      setTypeOpen(false);
      setEditingType(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Save failed');
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    try {
      if (deactivateTarget.kind === 'class') {
        await classMutations.deactivate.mutateAsync(deactivateTarget.row.id);
      } else {
        await typeMutations.deactivate.mutateAsync(deactivateTarget.row.id);
      }
      toast.success('Deactivated');
      setDeactivateTarget(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed');
    }
  }

  async function reactivate(kind: 'class' | 'type', row: CatalogueRow) {
    try {
      const mutations = kind === 'class' ? classMutations : typeMutations;
      await mutations.update.mutateAsync({ id: row.id, body: { isActive: true } });
      toast.success('Reactivated');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed');
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold leading-tight text-foreground">{section.title}</h2>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </div>
        {canManage ? (
          <Button type="button" className="h-9 shrink-0" onClick={openAddClass}>
            <IconPlus className="h-4 w-4" />
            Add class
          </Button>
        ) : null}
      </div>

      <div className="mb-3">
        <label className="relative block max-w-sm">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search classes or types…"
            className="pl-9"
          />
        </label>
      </div>

      <RequestClassesTypesTable
        groups={pageGroups}
        meta={meta}
        isPending={isPending}
        error={error}
        canManage={canManage}
        forceExpandedIds={forceExpandedIds}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
        onEditClass={openEditClass}
        onDeactivateClass={(row) => setDeactivateTarget({ kind: 'class', row })}
        onReactivateClass={(row) => void reactivate('class', row)}
        onAddType={openAddType}
        onEditType={openEditType}
        onDeactivateType={(row) => setDeactivateTarget({ kind: 'type', row })}
        onReactivateType={(row) => void reactivate('type', row)}
      />

      <Dialog open={classOpen} onOpenChange={setClassOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClass ? 'Edit request class' : 'Add request class'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={classForm.name}
                onChange={(e) => setClassForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input
                value={classForm.code}
                onChange={(e) => setClassForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={classForm.description}
                onChange={(e) => setClassForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClassOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveClass()}
              disabled={!classForm.name.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingType ? 'Edit request type' : 'Add request type'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={typeForm.name}
                onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Expected documents</Label>
              <Input
                type="number"
                min={1}
                value={typeForm.expectedDocuments}
                onChange={(e) =>
                  setTypeForm((f) => ({ ...f, expectedDocuments: e.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Request class</Label>
              <select
                className="flex h-11 w-full rounded-md border border-input bg-primary/5 px-3 text-sm disabled:opacity-60"
                value={typeForm.requestClassId}
                disabled={typeClassLocked && !editingType}
                onChange={(e) =>
                  setTypeForm((f) => ({ ...f, requestClassId: e.target.value }))
                }
              >
                {realClasses.map((rc) => (
                  <option key={rc.id} value={rc.id}>
                    {rc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveType()}
              disabled={!typeForm.name.trim() || !typeForm.requestClassId}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deactivate {deactivateTarget?.row.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This item will be marked inactive and hidden from default lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeactivate()}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
