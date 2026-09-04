'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton, Combobox } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import {
  useAddRequestClass,
  type EngagementWorkspace,
} from '@/features/engagements/hooks/use-engagements';
import {
  useCatalogueList,
  useCatalogueMutations,
} from '@/features/catalogues/hooks/use-catalogue';

const addClassSchema = z.object({
  requestClassId: z.string().min(1, 'Request class is required'),
});

type AddClassFormValues = z.infer<typeof addClassSchema>;

interface AddRequestClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: EngagementWorkspace;
}

export function AddRequestClassDialog({
  open,
  onOpenChange,
  workspace,
}: AddRequestClassDialogProps) {
  const { can } = useAuth();
  const canManageCatalogue = can('catalogue:manage');
  const addClass = useAddRequestClass(workspace.id);
  const classMutations = useCatalogueMutations('request-classes');
  const allClasses = useCatalogueList('request-classes', 'pageSize=100&isActive=true');
  const engagementTypes = useCatalogueList('engagement-types', 'pageSize=100&isActive=true');
  const [creatingClass, setCreatingClass] = useState(false);

  const form = useForm<AddClassFormValues>({
    resolver: zodResolver(addClassSchema),
    defaultValues: { requestClassId: '' },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ requestClassId: '' });
    setCreatingClass(false);
  }, [open, form]);

  const suggestedIds = useMemo(() => {
    const et = engagementTypes.data?.data.find((t) => t.id === workspace.engagementTypeId);
    return new Set(et?.suggestedRequestClassIds ?? []);
  }, [engagementTypes.data, workspace.engagementTypeId]);

  const scopedIds = useMemo(
    () => new Set((workspace.classRollups ?? []).map((r) => r.requestClassId)),
    [workspace.classRollups],
  );

  const selectOptions = useMemo(() => {
    const available = (allClasses.data?.data ?? []).filter((c) => !scopedIds.has(c.id));
    const suggested = available
      .filter((c) => suggestedIds.has(c.id))
      .map((c) => ({ value: String(c.id), label: `${c.name} (Suggested)` }));
    const other = available
      .filter((c) => !suggestedIds.has(c.id))
      .map((c) => ({ value: String(c.id), label: c.name }));
    return [...suggested, ...other];
  }, [allClasses.data, scopedIds, suggestedIds]);

  const selectedClassId = form.watch('requestClassId');
  const busy = addClass.isPending || creatingClass;

  async function handleAddClass(values: AddClassFormValues) {
    try {
      await addClass.mutateAsync({ requestClassId: Number(values.requestClassId) });
      toast.success('Request class added');
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to add class');
    }
  }

  async function handleCreateClass(name: string) {
    if (!canManageCatalogue) return;
    setCreatingClass(true);
    try {
      const created = await classMutations.create.mutateAsync({ name });
      await addClass.mutateAsync({ requestClassId: created.id });
      toast.success(`Created and added “${created.name}”`);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to create request class');
      throw err;
    } finally {
      setCreatingClass(false);
    }
  }

  const showEmpty =
    selectOptions.length === 0 && !allClasses.isPending && !canManageCatalogue;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add request class"
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleAddClass)}
            loading={busy}
            disabled={!selectedClassId || busy}
          >
            Add class
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {showEmpty ? (
          <p className="text-sm text-muted-foreground">
            Every active request class is already in scope for this engagement.
          </p>
        ) : (
          <FormField
            label="Request class"
            error={form.formState.errors.requestClassId?.message}
            required
            description={
              canManageCatalogue
                ? 'Search existing classes, or create a new one. New classes are added to this engagement immediately.'
                : 'Any active class can be added. Suggested classes for this engagement type appear first.'
            }
          >
            <Combobox
              options={selectOptions}
              value={selectedClassId}
              onValueChange={(value) =>
                form.setValue('requestClassId', value, { shouldValidate: true })
              }
              placeholder={
                canManageCatalogue ? 'Search or create class' : 'Select class'
              }
              searchPlaceholder="Search classes…"
              emptyMessage={
                canManageCatalogue
                  ? 'No matching classes — create a new one'
                  : 'No classes available'
              }
              isLoading={allClasses.isPending || engagementTypes.isPending}
              creatable={canManageCatalogue}
              creating={creatingClass}
              onCreate={handleCreateClass}
            />
          </FormField>
        )}
      </div>
    </FormDialog>
  );
}
