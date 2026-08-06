'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { IconArrowRight } from '@tabler/icons-react';
import { FormDialog, FormField, LoadingButton, AppSelect } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BffClientError } from '@/lib/bff/client';
import { useTransitionEngagement } from '@/features/engagements/hooks/use-engagements';
import type { EngagementWorkspace } from '@/features/engagements/hooks/use-engagements';

const transitionSchema = z.object({
  toStage: z.string().min(1, 'Target stage is required'),
  note: z.string().max(500).optional(),
});

type TransitionFormValues = z.infer<typeof transitionSchema>;

interface TransitionEngagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: EngagementWorkspace;
}

export function TransitionEngagementDialog({
  open,
  onOpenChange,
  workspace,
}: TransitionEngagementDialogProps) {
  const transition = useTransitionEngagement(workspace.id);

  const form = useForm<TransitionFormValues>({
    resolver: zodResolver(transitionSchema),
    defaultValues: {
      toStage: workspace.allowedNextStages[0] ?? '',
      note: '',
    },
  });

  async function handleSubmit(values: TransitionFormValues) {
    try {
      await transition.mutateAsync({ toStage: values.toStage, note: values.note });
      toast.success(`Engagement moved to ${values.toStage}`);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof BffClientError ? err.message : 'Failed to transition engagement';
      toast.error(message);
    }
  }

  const canComplete = workspace.canComplete;
  const missingCount = workspace.missingRequestClassIds.length;

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Transition engagement"
      description={`Move ${workspace.referenceCode} to the next stage`}
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={transition.isPending}>
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleSubmit)}
            loading={transition.isPending}
            disabled={!form.formState.isValid}
          >
            <IconArrowRight className="mr-2 h-4 w-4" />
            Transition
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {!canComplete && workspace.allowedNextStages.includes('Completed') ? (
          <Alert variant="destructive">
            <AlertDescription>
              {missingCount > 0
                ? `Cannot complete: ${missingCount} request class${missingCount !== 1 ? 'es' : ''} still need sign-off before completion.`
                : 'Cannot complete: add and sign off at least one request class, or use engagement-wide sign-off.'}
            </AlertDescription>
          </Alert>
        ) : null}

        <FormField label="Target stage" error={form.formState.errors.toStage?.message} required>
          <AppSelect
            {...form.register('toStage')}
            options={workspace.allowedNextStages
              .filter((stage) => stage !== 'Completed' || canComplete)
              .map((stage) => ({ value: stage, label: stage }))}
            value={form.watch('toStage')}
            onValueChange={(value) => form.setValue('toStage', value, { shouldValidate: true })}
            placeholder="Select stage"
          />
        </FormField>

        <FormField label="Note (optional)" error={form.formState.errors.note?.message}>
          <Textarea
            {...form.register('note')}
            placeholder="Add a note about this transition..."
            rows={3}
          />
        </FormField>

        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Current stage: {workspace.stage}</p>
          <p className="text-muted-foreground">
            Progress: {workspace.progressPercent}% · {workspace.requestCount} request
            {workspace.requestCount === 1 ? '' : 's'} · {workspace.overdueCount} overdue
          </p>
        </div>
      </div>
    </FormDialog>
  );
}
