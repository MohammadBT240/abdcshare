'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { IconPlus } from '@tabler/icons-react';
import { FormDialog, FormField, LoadingButton, AppSelect } from '@/components/forms';
import { DatePicker } from '@/components/forms/date-picker';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BffClientError } from '@/lib/bff/client';
import { useCreateRequest } from '@/features/requests/hooks/use-requests';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import type { EngagementTeamMember } from '@/features/engagements/hooks/use-engagements';

const createRequestSchema = z.object({
  engagementId: z.string().min(1, 'Engagement is required'),
  requestClassId: z.string().min(1, 'Request class is required'),
  requestTypeId: z.string().min(1, 'Request type is required'),
  description: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
});

type CreateRequestFormValues = z.infer<typeof createRequestSchema>;

export interface InScopeRequestClass {
  id: number;
  name: string;
}

interface CreateRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId?: string;
  engagementTitle?: string;
  workingPhase?: string;
  /** Classes in scope on this engagement (required for create). */
  inScopeClasses: InScopeRequestClass[];
  /** Prefill from Requests tab rail; ignored if not in scope. */
  initialRequestClassId?: number;
  /** Engagement team — available assignees. */
  teamMembers?: EngagementTeamMember[];
  onCreated?: (id: string) => void;
}

export function CreateRequestDialog({
  open,
  onOpenChange,
  engagementId,
  engagementTitle,
  workingPhase,
  inScopeClasses,
  initialRequestClassId,
  teamMembers = [],
  onCreated,
}: CreateRequestDialogProps) {
  const create = useCreateRequest();
  const requestTypes = useCatalogueList('request-types', 'pageSize=100&isActive=true');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);

  const classOptions = useMemo(
    () => inScopeClasses.map((c) => ({ value: String(c.id), label: c.name })),
    [inScopeClasses],
  );

  const defaultClassId = useMemo(() => {
    if (
      initialRequestClassId != null &&
      inScopeClasses.some((c) => c.id === initialRequestClassId)
    ) {
      return String(initialRequestClassId);
    }
    if (inScopeClasses.length === 1) return String(inScopeClasses[0]!.id);
    return '';
  }, [initialRequestClassId, inScopeClasses]);

  const form = useForm<CreateRequestFormValues>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      engagementId: engagementId ?? '',
      requestClassId: defaultClassId,
      requestTypeId: '',
      description: '',
      dueDate: '',
    },
  });

  const selectedClassId = form.watch('requestClassId');

  const typeOptions = useMemo(() => {
    const rows = requestTypes.data?.data ?? [];
    const classId = selectedClassId ? Number(selectedClassId) : null;
    if (classId == null || Number.isNaN(classId)) return [];
    return rows
      .filter((rt) => rt.requestClassId === classId)
      .map((rt) => ({ value: String(rt.id), label: rt.name }));
  }, [requestTypes.data, selectedClassId]);

  const selectedClassName = inScopeClasses.find((c) => String(c.id) === selectedClassId)?.name;
  const singleClass = inScopeClasses.length === 1;

  useEffect(() => {
    if (!open) return;
    form.reset({
      engagementId: engagementId ?? '',
      requestClassId: defaultClassId,
      requestTypeId: '',
      description: '',
      dueDate: '',
    });
    setAssigneeIds([]);
  }, [open, engagementId, defaultClassId, form]);

  function toggleAssignee(userId: string, checked: boolean) {
    setAssigneeIds((prev) =>
      checked ? [...prev, userId] : prev.filter((id) => id !== userId),
    );
  }

  async function handleSubmit(values: CreateRequestFormValues) {
    try {
      const result = await create.mutateAsync({
        engagementId: values.engagementId,
        requestTypeId: Number(values.requestTypeId),
        description: values.description || undefined,
        dueDate: values.dueDate || undefined,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      });
      toast.success('Request created successfully');
      onOpenChange(false);
      if (onCreated) onCreated(result.id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to create request');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create request"
      description={
        engagementTitle ? `Add a new request to ${engagementTitle}` : 'Create a new request'
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleSubmit)}
            loading={create.isPending}
            disabled={!form.formState.isValid || inScopeClasses.length === 0}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Create request
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {workingPhase ? (
          <Alert>
            <AlertDescription>
              Phase will be recorded as <strong>{workingPhase}</strong> (based on current engagement
              stage)
            </AlertDescription>
          </Alert>
        ) : null}

        {inScopeClasses.length === 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              No request classes are in scope. Add a class under Settings before creating requests.
            </AlertDescription>
          </Alert>
        ) : null}

        {singleClass ? (
          <Alert>
            <AlertDescription>
              Request class: <strong>{selectedClassName}</strong>
            </AlertDescription>
          </Alert>
        ) : (
          <FormField
            label="Request class"
            error={form.formState.errors.requestClassId?.message}
            required
            description="Chooses which class this request belongs to (via its request type)."
          >
            <AppSelect
              options={classOptions}
              placeholder="Select class"
              value={selectedClassId}
              onValueChange={(value) => {
                form.setValue('requestClassId', value, { shouldValidate: true });
                form.setValue('requestTypeId', '', { shouldValidate: true });
              }}
            />
          </FormField>
        )}

        <FormField label="Request type" error={form.formState.errors.requestTypeId?.message} required>
          <AppSelect
            {...form.register('requestTypeId')}
            options={typeOptions}
            placeholder={selectedClassId ? 'Select type' : 'Select a class first'}
            isLoading={requestTypes.isPending}
            disabled={!selectedClassId}
            onValueChange={(value) => form.setValue('requestTypeId', value, { shouldValidate: true })}
            value={form.watch('requestTypeId')}
          />
        </FormField>

        <FormField label="Description" error={form.formState.errors.description?.message}>
          <Textarea
            {...form.register('description')}
            placeholder="Optional additional details..."
            rows={3}
          />
        </FormField>

        <FormField label="Due date" error={form.formState.errors.dueDate?.message}>
          <DatePicker
            value={form.watch('dueDate') ? new Date(form.watch('dueDate')!) : undefined}
            onChange={(date) =>
              form.setValue('dueDate', date ? date.toISOString().split('T')[0] : '')
            }
          />
        </FormField>

        <FormField
          label="Assignees"
          description={
            teamMembers.length === 0
              ? 'Add team members under Settings before assigning.'
              : 'Optional. Assignees receive an in-app and email notification.'
          }
        >
          {teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members on this engagement.</p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {teamMembers.map((m) => {
                const checked = assigneeIds.includes(m.userId);
                return (
                  <li key={m.userId} className="flex items-center gap-2">
                    <Checkbox
                      id={`assignee-${m.userId}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleAssignee(m.userId, value === true)}
                    />
                    <label
                      htmlFor={`assignee-${m.userId}`}
                      className="flex min-w-0 flex-1 cursor-pointer flex-col text-sm"
                    >
                      <span className="truncate font-medium">{m.fullName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {m.memberRole}
                        {m.email ? ` · ${m.email}` : ''}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </FormField>
      </div>
    </FormDialog>
  );
}
