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
  Combobox,
  MultiCombobox,
} from '@/components/forms';
import { DatePicker } from '@/components/forms/date-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BffClientError } from '@/lib/bff/client';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useCreateEngagement } from '@/features/engagements/hooks/use-engagements';
import {
  useClientContacts,
  useClientsList,
} from '@/features/clients/hooks/use-clients';
import { AddClientDialog } from '@/features/clients/components/add-client-dialog';
import {
  useCatalogueList,
  useCatalogueMutations,
} from '@/features/catalogues/hooks/use-catalogue';

const createEngagementSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  engagementTypeId: z.string().min(1, 'Engagement type is required'),
  departmentId: z.string().min(1, 'Department is required'),
  title: z.string().min(1, 'Title is required').max(255),
  periodLabel: z.string().max(100).optional(),
  startDate: z.string().optional(),
  targetCompletionDate: z.string().optional(),
});

type CreateEngagementFormValues = z.infer<typeof createEngagementSchema>;

const emptyValues: CreateEngagementFormValues = {
  clientId: '',
  engagementTypeId: '',
  departmentId: '',
  title: '',
  periodLabel: '',
  startDate: '',
  targetCompletionDate: '',
};

interface CreateEngagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string) => void;
}

export function CreateEngagementDialog({ open, onOpenChange, onCreated }: CreateEngagementDialogProps) {
  const { can } = useAuth();
  const canManageClients = can('client:manage');
  const create = useCreateEngagement();
  const typeMutations = useCatalogueMutations('engagement-types');
  const [selectedRequestClassIds, setSelectedRequestClassIds] = useState<number[]>([]);
  const [creatingType, setCreatingType] = useState(false);
  const [pendingTypeLabel, setPendingTypeLabel] = useState<string | null>(null);
  const [contactUserIds, setContactUserIds] = useState<string[]>([]);
  const [mainContactUserId, setMainContactUserId] = useState('');
  const [emailContactUserIds, setEmailContactUserIds] = useState<string[]>([]);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const form = useForm<CreateEngagementFormValues>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: emptyValues,
  });

  const clients = useClientsList('pageSize=100&isActive=true');
  const clientId = form.watch('clientId');
  const clientContacts = useClientContacts(clientId);
  const engagementTypes = useCatalogueList('engagement-types', 'pageSize=100&isActive=true');
  const departments = useCatalogueList('departments', 'pageSize=100&isActive=true');
  const requestClasses = useCatalogueList('request-classes', 'pageSize=100&isActive=true');

  const engagementTypeId = form.watch('engagementTypeId');
  const selectedEngagementType = useMemo(() => {
    return engagementTypes.data?.data.find((et) => String(et.id) === engagementTypeId);
  }, [engagementTypes.data, engagementTypeId]);

  const activeContacts = useMemo(
    () => (clientContacts.data ?? []).filter((c) => c.isActive),
    [clientContacts.data],
  );

  const selectedContacts = useMemo(
    () => activeContacts.filter((c) => contactUserIds.includes(c.id)),
    [activeContacts, contactUserIds],
  );

  const allRequestClasses = requestClasses.data?.data ?? [];
  const suggestedIds = selectedEngagementType?.suggestedRequestClassIds ?? [];
  const suggestedKey = suggestedIds.join(',');

  const engagementTypeOptions = useMemo(() => {
    const base =
      (engagementTypes.data?.data ?? []).map((et) => ({
        value: String(et.id),
        label: et.name,
      })) ?? [];
    if (
      engagementTypeId &&
      pendingTypeLabel &&
      !base.some((o) => o.value === engagementTypeId)
    ) {
      return [...base, { value: engagementTypeId, label: pendingTypeLabel }];
    }
    return base;
  }, [engagementTypes.data, engagementTypeId, pendingTypeLabel]);

  useEffect(() => {
    if (
      pendingTypeLabel &&
      engagementTypeId &&
      (engagementTypes.data?.data ?? []).some((et) => String(et.id) === engagementTypeId)
    ) {
      setPendingTypeLabel(null);
    }
  }, [engagementTypes.data, engagementTypeId, pendingTypeLabel]);

  const sortedRequestClasses = useMemo(() => {
    const suggested = new Set(suggestedIds);
    return [...allRequestClasses].sort((a, b) => {
      const aSug = suggested.has(a.id) ? 0 : 1;
      const bSug = suggested.has(b.id) ? 0 : 1;
      if (aSug !== bSug) return aSug - bSug;
      return a.name.localeCompare(b.name);
    });
  }, [allRequestClasses, suggestedKey]); // eslint-disable-line react-hooks/exhaustive-deps -- suggestedIds via key

  useEffect(() => {
    if (!open) {
      form.reset(emptyValues);
      setSelectedRequestClassIds([]);
      setCreatingType(false);
      setPendingTypeLabel(null);
      setContactUserIds([]);
      setMainContactUserId('');
      setEmailContactUserIds([]);
      setAddClientOpen(false);
    }
  }, [open, form]);

  useEffect(() => {
    if (!engagementTypeId) {
      setSelectedRequestClassIds([]);
      return;
    }
    setSelectedRequestClassIds(
      suggestedKey ? suggestedKey.split(',').map((id) => Number(id)) : [],
    );
  }, [engagementTypeId, suggestedKey]);

  // When client changes, default assigned/main/email to primary (or first active).
  useEffect(() => {
    if (!clientId || !activeContacts.length) {
      setContactUserIds([]);
      setMainContactUserId('');
      setEmailContactUserIds([]);
      return;
    }
    const primary = activeContacts.find((c) => c.isPrimary) ?? activeContacts[0]!;
    setContactUserIds([primary.id]);
    setMainContactUserId(primary.id);
    setEmailContactUserIds([primary.id]);
  }, [clientId, activeContacts]);

  useEffect(() => {
    // Keep main/email within the selected set.
    if (contactUserIds.length === 0) {
      setMainContactUserId('');
      setEmailContactUserIds([]);
      return;
    }
    if (!contactUserIds.includes(mainContactUserId)) {
      setMainContactUserId(contactUserIds[0]!);
    }
    setEmailContactUserIds((prev) => {
      const next = prev.filter((id) => contactUserIds.includes(id));
      if (next.length === 0) {
        return [contactUserIds.includes(mainContactUserId) ? mainContactUserId : contactUserIds[0]!];
      }
      return next;
    });
  }, [contactUserIds, mainContactUserId]);

  async function handleCreateType(name: string) {
    setCreatingType(true);
    try {
      const created = await typeMutations.create.mutateAsync({ name });
      setPendingTypeLabel(created.name);
      form.setValue('engagementTypeId', String(created.id), { shouldValidate: true });
      toast.success(`Created engagement type “${created.name}”`);
    } catch (err) {
      const message =
        err instanceof BffClientError ? err.message : 'Failed to create engagement type';
      toast.error(message);
      throw err;
    } finally {
      setCreatingType(false);
    }
  }

  async function handleSubmit(values: CreateEngagementFormValues) {
    if (contactUserIds.length === 0) {
      toast.error('Select at least one client contact');
      return;
    }
    if (!mainContactUserId || !contactUserIds.includes(mainContactUserId)) {
      toast.error('Select a main client contact');
      return;
    }
    if (emailContactUserIds.length === 0) {
      toast.error('Enable email for at least one contact');
      return;
    }
    try {
      const payload = {
        clientId: values.clientId,
        engagementTypeId: Number(values.engagementTypeId),
        departmentId: Number(values.departmentId),
        title: values.title,
        periodLabel: values.periodLabel || undefined,
        startDate: values.startDate || undefined,
        targetCompletionDate: values.targetCompletionDate || undefined,
        requestClassIds: selectedRequestClassIds.length > 0 ? selectedRequestClassIds : undefined,
        clientContactUserIds: contactUserIds,
        mainClientContactUserId: mainContactUserId,
        emailClientContactUserIds: emailContactUserIds,
      };

      const result = await create.mutateAsync(payload);
      toast.success('Engagement created successfully');
      onOpenChange(false);
      if (onCreated) onCreated(result.id);
    } catch (err) {
      const message = err instanceof BffClientError ? err.message : 'Failed to create engagement';
      toast.error(message);
    }
  }

  const clientOptions = useMemo(() => {
    const base =
      clients.data?.data.map((c) => ({ value: c.id, label: c.name })) ?? [];
    if (clientId && !base.some((o) => o.value === clientId)) {
      return [...base, { value: clientId, label: 'New client' }];
    }
    return base;
  }, [clients.data, clientId]);

  function toggleRequestClass(id: number) {
    setSelectedRequestClassIds((prev) =>
      prev.includes(id) ? prev.filter((rcId) => rcId !== id) : [...prev, id],
    );
  }

  return (
    <>
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Create engagement"
      description="Set up a new engagement with client, type, and initial request classes"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending || creatingType}
          >
            Cancel
          </Button>
          <LoadingButton
            onClick={form.handleSubmit(handleSubmit)}
            loading={create.isPending}
            disabled={!form.formState.isValid || creatingType}
          >
            <IconPlus className="mr-2 h-4 w-4" />
            Create engagement
          </LoadingButton>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <FormField label="Client" error={form.formState.errors.clientId?.message} required>
            <Combobox
              options={clientOptions}
              placeholder="Search or create client"
              searchPlaceholder="Search clients…"
              emptyMessage="No clients found"
              isLoading={clients.isPending}
              onValueChange={(value) =>
                form.setValue('clientId', value, { shouldValidate: true })
              }
              value={form.watch('clientId')}
              footerAction={
                canManageClients
                  ? { label: 'Create client', onSelect: () => setAddClientOpen(true) }
                  : undefined
              }
            />
          </FormField>

          {clientId ? (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
              <FormField
                label="Client contacts"
                required
                description="Assigned contacts can see this engagement. Main is the default owner."
              >
                <MultiCombobox
                  options={activeContacts.map((c) => ({
                    value: c.id,
                    label: c.isPrimary ? `${c.fullName} (Primary)` : c.fullName,
                    description: c.email,
                  }))}
                  values={contactUserIds}
                  onValuesChange={setContactUserIds}
                  placeholder="Select contacts…"
                  searchPlaceholder="Search contacts…"
                  emptyMessage={
                    clientContacts.isPending ? 'Loading…' : 'No contacts for this client'
                  }
                />
              </FormField>

              {selectedContacts.length > 0 ? (
                <>
                  <FormField label="Main contact" required>
                    <AppSelect
                      options={selectedContacts.map((c) => ({
                        value: c.id,
                        label: c.fullName,
                      }))}
                      value={mainContactUserId}
                      onValueChange={setMainContactUserId}
                      placeholder="Select main"
                    />
                  </FormField>
                  <div className="space-y-2">
                    <Label>Email notifications</Label>
                    <p className="text-xs text-muted-foreground">
                      At least one contact must receive email. All assigned get in-app.
                    </p>
                    {selectedContacts.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={emailContactUserIds.includes(c.id)}
                          onCheckedChange={(checked) => {
                            setEmailContactUserIds((prev) => {
                              if (checked === true) {
                                return prev.includes(c.id) ? prev : [...prev, c.id];
                              }
                              return prev.filter((id) => id !== c.id);
                            });
                          }}
                        />
                        {c.fullName}
                      </label>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <FormField
            label="Engagement type"
            error={form.formState.errors.engagementTypeId?.message}
            required
            description="Search existing types or create a new one if it is not in the list."
          >
            <Combobox
              options={engagementTypeOptions}
              value={form.watch('engagementTypeId')}
              onValueChange={(value) =>
                form.setValue('engagementTypeId', value, { shouldValidate: true })
              }
              placeholder="Search or create type"
              searchPlaceholder="Search types…"
              emptyMessage="No types found"
              isLoading={engagementTypes.isPending}
              creatable
              creating={creatingType}
              onCreate={handleCreateType}
            />
          </FormField>

          <FormField label="Department" error={form.formState.errors.departmentId?.message} required>
            <AppSelect
              {...form.register('departmentId')}
              options={
                departments.data?.data.map((d) => ({ value: String(d.id), label: d.name })) ?? []
              }
              placeholder="Select department"
              isLoading={departments.isPending}
              onValueChange={(value) => form.setValue('departmentId', value, { shouldValidate: true })}
              value={form.watch('departmentId')}
            />
          </FormField>

          <FormField label="Title" error={form.formState.errors.title?.message} required>
            <Input {...form.register('title')} placeholder="e.g. Statutory Audit 2024" />
          </FormField>

          <FormField label="Period label" error={form.formState.errors.periodLabel?.message}>
            <Input {...form.register('periodLabel')} placeholder="e.g. FY 2024" />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Start date" error={form.formState.errors.startDate?.message}>
              <DatePicker
                value={form.watch('startDate') ? new Date(form.watch('startDate')!) : undefined}
                onChange={(date) =>
                  form.setValue('startDate', date ? date.toISOString().split('T')[0] : '')
                }
              />
            </FormField>

            <FormField
              label="Target completion"
              error={form.formState.errors.targetCompletionDate?.message}
            >
              <DatePicker
                value={
                  form.watch('targetCompletionDate')
                    ? new Date(form.watch('targetCompletionDate')!)
                    : undefined
                }
                onChange={(date) =>
                  form.setValue(
                    'targetCompletionDate',
                    date ? date.toISOString().split('T')[0] : '',
                  )
                }
              />
            </FormField>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>Request classes</Label>
            <p className="text-sm text-muted-foreground">
              Suggested for this type — you can add any class ({selectedRequestClassIds.length}{' '}
              selected)
            </p>
          </div>

          {sortedRequestClasses.length > 0 ? (
            <ScrollArea className="h-[400px] rounded-md border border-input p-3">
              <div className="space-y-2">
                {sortedRequestClasses.map((rc) => {
                  const isSuggested = suggestedIds.includes(rc.id);
                  return (
                    <div key={rc.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`rc-${rc.id}`}
                        checked={selectedRequestClassIds.includes(rc.id)}
                        onCheckedChange={() => toggleRequestClass(rc.id)}
                      />
                      <label
                        htmlFor={`rc-${rc.id}`}
                        className="flex-1 cursor-pointer text-sm leading-tight"
                      >
                        <div className="font-medium">
                          {rc.name}
                          {isSuggested ? (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Suggested
                            </span>
                          ) : null}
                        </div>
                        {rc.description ? (
                          <div className="text-xs text-muted-foreground">{rc.description}</div>
                        ) : null}
                      </label>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No active request classes</p>
          )}
        </div>
      </div>
    </FormDialog>
    <AddClientDialog
      open={addClientOpen}
      onOpenChange={setAddClientOpen}
      onCreated={(id) => {
        form.setValue('clientId', id, { shouldValidate: true });
        setAddClientOpen(false);
      }}
    />
    </>
  );
}
