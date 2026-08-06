'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { IconPlus } from '@tabler/icons-react';
import {
  FormDialog,
  FormField,
  LoadingButton,
  AppSelect,
  MultiCombobox,
  FileUpload,
  ATTACHMENT_ACCEPT,
  DOCUMENT_MAX_BYTES,
} from '@/components/forms';
import { DatePicker } from '@/components/forms/date-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BffClientError } from '@/lib/bff/client';
import {
  uploadRequestBrief,
  useCreateRequest,
} from '@/features/requests/hooks/use-requests';
import { useCatalogueList } from '@/features/catalogues/hooks/use-catalogue';
import type { EngagementTeamMember } from '@/features/engagements/hooks/use-engagements';

const createRequestSchema = z.object({
  engagementId: z.string().min(1, 'Engagement is required'),
  requestClassId: z.string().min(1, 'Request class is required'),
  requestTypeId: z.string().min(1, 'Request type is required'),
  description: z.string().max(1000).optional(),
  dueDate: z.string().optional(),
  expectedDocumentCount: z.number().int().min(1).max(500),
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
  const [briefFiles, setBriefFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

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
      expectedDocumentCount: 1,
    },
  });

  const selectedClassId = form.watch('requestClassId');
  const selectedTypeId = form.watch('requestTypeId');

  const typeRows = useMemo(() => {
    const rows = requestTypes.data?.data ?? [];
    const classId = selectedClassId ? Number(selectedClassId) : null;
    if (classId == null || Number.isNaN(classId)) return [];
    return rows.filter((rt) => rt.requestClassId === classId);
  }, [requestTypes.data, selectedClassId]);

  const typeOptions = useMemo(
    () => typeRows.map((rt) => ({ value: String(rt.id), label: rt.name })),
    [typeRows],
  );

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
      expectedDocumentCount: 1,
    });
    setAssigneeIds([]);
    setBriefFiles([]);
  }, [open, engagementId, defaultClassId, form]);

  useEffect(() => {
    if (!selectedTypeId) return;
    const type = typeRows.find((rt) => String(rt.id) === selectedTypeId);
    const expected = type?.expectedDocuments;
    if (expected != null && expected >= 1) {
      form.setValue('expectedDocumentCount', expected, { shouldValidate: true });
    }
  }, [selectedTypeId, typeRows, form]);

  async function handleSubmit(values: CreateRequestFormValues) {
    setSubmitting(true);
    try {
      const result = await create.mutateAsync({
        engagementId: values.engagementId,
        requestTypeId: Number(values.requestTypeId),
        description: values.description || undefined,
        dueDate: values.dueDate || undefined,
        expectedDocumentCount: values.expectedDocumentCount,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : undefined,
      });
      const brief = briefFiles[0];
      if (brief) {
        try {
          await uploadRequestBrief(result.id, brief);
        } catch (briefErr) {
          toast.error(
            briefErr instanceof BffClientError
              ? briefErr.message
              : 'Request created, but the expectation brief failed to upload. You can attach it from the request overview.',
          );
          onOpenChange(false);
          if (onCreated) onCreated(result.id);
          return;
        }
      }
      toast.success('Request created successfully');
      onOpenChange(false);
      if (onCreated) onCreated(result.id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  }

  const busy = submitting || create.isPending;

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleSubmit)}
            loading={busy}
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

        <FormField
          label="Expected documents"
          error={form.formState.errors.expectedDocumentCount?.message}
          required
          description="Used to measure request progress (accepted ÷ expected)."
        >
          <Input
            type="number"
            min={1}
            max={500}
            {...form.register('expectedDocumentCount', { valueAsNumber: true })}
          />
        </FormField>

        <FormField label="Description" error={form.formState.errors.description?.message}>
          <Textarea
            {...form.register('description')}
            placeholder="Optional additional details..."
            rows={3}
          />
        </FormField>

        <FormField
          label="Expectation brief"
          description="Optional. Visible to the client on the request overview."
        >
          <FileUpload
            files={briefFiles}
            onChange={setBriefFiles}
            multiple={false}
            accept={ATTACHMENT_ACCEPT}
            maxBytes={DOCUMENT_MAX_BYTES}
            label="Attach brief (optional)"
            description="PDF, Office, or image — max one file."
            disabled={busy}
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
            <MultiCombobox
              values={assigneeIds}
              onValuesChange={setAssigneeIds}
              options={teamMembers.map((m) => ({
                value: m.userId,
                label: m.fullName,
                description: m.email
                  ? `${m.memberRole} · ${m.email}`
                  : m.memberRole,
                avatarUrl: m.avatarUrl,
              }))}
              placeholder="Search and select assignees…"
              searchPlaceholder="Search team…"
              emptyMessage="No matching team members"
            />
          )}
        </FormField>
      </div>
    </FormDialog>
  );
}
