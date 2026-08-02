'use client';

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton, AppSelect } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import {
  useAddRequestClass,
  type EngagementWorkspace,
} from '@/features/engagements/hooks/use-engagements';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';

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
  const addClass = useAddRequestClass(workspace.id);
  const allClasses = useCatalogueList('request-classes', 'pageSize=100&isActive=true');
  const engagementTypes = useCatalogueList('engagement-types', 'pageSize=100&isActive=true');

  const form = useForm<AddClassFormValues>({
    resolver: zodResolver(addClassSchema),
    defaultValues: { requestClassId: '' },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({ requestClassId: '' });
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
            disabled={addClass.isPending}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleAddClass)}
            loading={addClass.isPending}
            disabled={selectOptions.length === 0}
          >
            Add class
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {selectOptions.length === 0 && !allClasses.isPending ? (
          <p className="text-sm text-muted-foreground">
            Every active request class is already in scope for this engagement.
          </p>
        ) : (
          <FormField
            label="Request class"
            error={form.formState.errors.requestClassId?.message}
            required
            description="Any active class can be added. Suggested classes for this engagement type appear first."
          >
            <AppSelect
              {...form.register('requestClassId')}
              options={selectOptions}
              value={form.watch('requestClassId')}
              onValueChange={(value) =>
                form.setValue('requestClassId', value, { shouldValidate: true })
              }
              placeholder="Select class"
              isLoading={allClasses.isPending || engagementTypes.isPending}
            />
          </FormField>
        )}
      </div>
    </FormDialog>
  );
}
