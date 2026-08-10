'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  IconBell,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { AppSelect, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusPill } from '@/components/data';
import { Label } from '@/components/ui/label';
import { BffClientError, bffApi } from '@/lib/bff/client';
import type { UserListResponse } from '@/features/users/types';
import {
  useInvitePartnerReporter,
  usePartnerReporters,
  useRemindPartnerReporter,
  useRemovePartnerReporter,
  useRequestPartnerReport,
  useUpdatePartnerReporter,
  type PartnerReportCadence,
  type Reporter,
} from '@/features/partner-reports/hooks/use-partner-reports';
import {
  inviteReporterSchema,
  type InviteReporterFormValues,
} from '@/features/partner-reports/schemas/invite.schema';

const emptyGuest: InviteReporterFormValues = { email: '', fullName: '', title: '' };

const CADENCE_OPTIONS = [
  { value: 'Weekly', label: 'Weekly' },
  { value: 'Monthly', label: 'Monthly' },
  { value: 'Quarterly', label: 'Quarterly' },
  { value: 'None', label: 'Ad hoc only' },
];

function kindLabel(kind: Reporter['kind']): string {
  if (kind === 'partner') return 'Partner';
  if (kind === 'guest') return 'Guest';
  if (kind === 'client') return 'Client';
  return 'Staff';
}

function expectationPill(r: Reporter): { tone: 'success' | 'warning' | 'info'; label: string } {
  if (r.expectation === 'requested') return { tone: 'info', label: 'Requested' };
  if (r.expectation === 'due') return { tone: 'warning', label: 'Due' };
  return { tone: 'success', label: 'Up to date' };
}

function formatWhen(iso?: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

interface InviteReporterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteReporterDialog({ open, onOpenChange }: InviteReporterDialogProps) {
  const [tab, setTab] = useState<'existing' | 'external'>('existing');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [cadence, setCadence] = useState<PartnerReportCadence>('Weekly');
  const [financialsEnabled, setFinancialsEnabled] = useState(true);
  const [requestUser, setRequestUser] = useState<Reporter | null>(null);
  const [requestNote, setRequestNote] = useState('');

  const invite = useInvitePartnerReporter();
  const remove = useRemovePartnerReporter();
  const updateReporter = useUpdatePartnerReporter();
  const requestReport = useRequestPartnerReport();
  const remind = useRemindPartnerReporter();
  const reporters = usePartnerReporters(open);
  const users = useQuery({
    queryKey: ['users', 'list', 'partner-invite-picker'],
    queryFn: () => bffApi<UserListResponse>('/api/users?page=1&pageSize=100&isActive=true'),
    enabled: open,
    staleTime: 30_000,
  });

  const guestForm = useForm<InviteReporterFormValues>({
    resolver: zodResolver(inviteReporterSchema),
    defaultValues: emptyGuest,
  });

  useEffect(() => {
    if (!open) {
      guestForm.reset(emptyGuest);
      setSelectedUserId('');
      setTab('existing');
      setCadence('Weekly');
      setFinancialsEnabled(true);
      setRequestUser(null);
      setRequestNote('');
    }
  }, [open, guestForm]);

  const allowedIds = useMemo(
    () => new Set((reporters.data?.data ?? []).map((r) => r.userId)),
    [reporters.data?.data],
  );

  const personOptions = useMemo(() => {
    const rows = users.data?.data ?? [];
    return rows
      .filter((u) => {
        if (!u.isActive) return false;
        if (u.partnerDesignation === 'PrincipalPartner') return false;
        if (allowedIds.has(u.id)) return false;
        if (u.role === 'Staff') return true;
        if (u.role === 'Client') return true;
        if (u.role === 'Guest') return true;
        if (u.role === 'Super Admin' && u.partnerDesignation === 'Partner') return true;
        return false;
      })
      .map((u) => ({
        value: u.id,
        label: `${u.fullName} · ${u.email}`,
        meta: u,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [users.data?.data, allowedIds]);

  const selectedUser = personOptions.find((o) => o.value === selectedUserId)?.meta;
  const allowed = reporters.data?.data ?? [];

  async function enableExisting() {
    if (!selectedUser) {
      toast.error('Select a person to enable');
      return;
    }
    try {
      const result = await invite.mutateAsync({
        email: selectedUser.email,
        fullName: selectedUser.fullName,
        cadence,
        remindersEnabled: cadence !== 'None',
        financialsEnabled,
      });
      toast.success(
        result.outcome === 'allowed'
          ? `${selectedUser.fullName} can report and has been reminded`
          : `Reminder sent to ${selectedUser.fullName}`,
      );
      setSelectedUserId('');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to enable reporter');
    }
  }

  async function inviteExternal(values: InviteReporterFormValues) {
    try {
      const result = await invite.mutateAsync({
        email: values.email.trim(),
        fullName: values.fullName.trim(),
        title: values.title || undefined,
        cadence,
        remindersEnabled: cadence !== 'None',
        financialsEnabled,
      });
      toast.success(
        result.outcome === 'invited'
          ? 'Guest invited — credentials emailed'
          : result.outcome === 'allowed'
            ? 'Staff allowed and reminded'
            : 'Reminder sent',
      );
      guestForm.reset(emptyGuest);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to invite reporter');
    }
  }

  async function onRemove(reporter: Reporter) {
    try {
      await remove.mutateAsync(reporter.userId);
      toast.success(
        reporter.kind === 'guest' ? 'Guest invite revoked' : 'Removed from reporting roster',
      );
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to remove');
    }
  }

  async function onCadenceChange(reporter: Reporter, value: string) {
    try {
      await updateReporter.mutateAsync({
        userId: reporter.userId,
        cadence: value as PartnerReportCadence,
        remindersEnabled: value !== 'None' ? reporter.remindersEnabled : false,
      });
      toast.success(`Cadence updated for ${reporter.fullName}`);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to update cadence');
    }
  }

  async function onFinancialsChange(reporter: Reporter, enabled: boolean) {
    try {
      await updateReporter.mutateAsync({
        userId: reporter.userId,
        financialsEnabled: enabled,
      });
      toast.success(
        enabled
          ? `Financials enabled for ${reporter.fullName}`
          : `Financials disabled for ${reporter.fullName}`,
      );
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to update financials');
    }
  }

  async function sendRequest() {
    if (!requestUser) return;
    try {
      await requestReport.mutateAsync({
        userId: requestUser.userId,
        note: requestNote.trim() || undefined,
      });
      toast.success(`Report requested from ${requestUser.fullName}`);
      setRequestUser(null);
      setRequestNote('');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to request report');
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Reporting roster"
        description="Enable Staff, Clients, Partners, or invite an external guest. Cadence guides them — they can always submit anytime."
        maxWidthClass="sm:max-w-2xl"
        footer={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        }
      >
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold tracking-tight">Who can report</h3>
              <span className="text-xs text-muted-foreground">
                {reporters.isPending ? 'Loading…' : `${allowed.length} people`}
              </span>
            </div>

            {reporters.isError ? (
              <p className="text-sm text-destructive">Could not load the roster.</p>
            ) : allowed.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
                <p className="text-sm font-medium">No reporters yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Enable a Staff member or Partner, or invite an external guest below.
                </p>
              </div>
            ) : (
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
                {allowed.map((r) => {
                  const exp = expectationPill(r);
                  return (
                    <li
                      key={r.userId}
                      className="rounded-xl border border-border bg-card/60 p-3 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{r.fullName}</p>
                            <StatusPill tone="neutral">{kindLabel(r.kind)}</StatusPill>
                            <StatusPill tone={exp.tone}>{exp.label}</StatusPill>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.email}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Last submitted · {formatWhen(r.lastSubmittedAt)}
                          </p>
                          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={r.financialsEnabled}
                              onCheckedChange={(v) => void onFinancialsChange(r, v === true)}
                            />
                            Allow financials
                          </label>
                        </div>
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                          <AppSelect
                            size="sm"
                            value={r.cadence}
                            onValueChange={(v) => void onCadenceChange(r, v)}
                            options={CADENCE_OPTIONS}
                            className="min-w-[8.5rem]"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={requestReport.isPending}
                            onClick={() => {
                              setRequestUser(r);
                              setRequestNote('');
                            }}
                          >
                            <IconSend className="size-3.5" />
                            Request
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={remind.isPending}
                            onClick={() =>
                              void remind
                                .mutateAsync(r.userId)
                                .then(() => toast.success(`Reminder sent to ${r.fullName}`))
                                .catch((e) =>
                                  toast.error(
                                    e instanceof BffClientError ? e.message : 'Remind failed',
                                  ),
                                )
                            }
                            aria-label={`Remind ${r.fullName}`}
                          >
                            <IconBell className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="px-2 text-muted-foreground hover:text-destructive"
                            disabled={remove.isPending}
                            onClick={() => void onRemove(r)}
                            aria-label={`Remove ${r.fullName}`}
                          >
                            <IconTrash className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <div className="rounded-xl border border-border bg-muted/15 p-4">
            <p className="mb-3 text-sm font-semibold">Add someone</p>
            <FormField label="Preferred cadence" description="Soft preference — never blocks an ad-hoc report.">
              <AppSelect
                value={cadence}
                onValueChange={(v) => setCadence(v as PartnerReportCadence)}
                options={CADENCE_OPTIONS}
              />
            </FormField>
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id="allow-financials-new"
                checked={financialsEnabled}
                onCheckedChange={(v) => setFinancialsEnabled(v === true)}
              />
              <Label htmlFor="allow-financials-new" className="text-sm font-normal">
                Allow financials
              </Label>
            </div>

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as 'existing' | 'external')}
              className="mt-4"
            >
              <TabsList className="w-full">
                <TabsTrigger value="existing" className="flex-1">
                  Existing person
                </TabsTrigger>
                <TabsTrigger value="external" className="flex-1">
                  External guest
                </TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="mt-4 space-y-4">
                <FormField label="Person" required>
                  <AppSelect
                    value={selectedUserId}
                    onValueChange={setSelectedUserId}
                    placeholder={users.isPending ? 'Loading people…' : 'Search by name or email'}
                    searchPlaceholder="Search name or email…"
                    emptyMessage="No eligible people found"
                    isLoading={users.isPending}
                    options={personOptions.map(({ value, label }) => ({ value, label }))}
                  />
                </FormField>
                <div className="flex justify-end">
                  <LoadingButton
                    type="button"
                    loading={invite.isPending}
                    disabled={!selectedUserId}
                    onClick={() => void enableExisting()}
                  >
                    Enable & remind
                  </LoadingButton>
                </div>
              </TabsContent>

              <TabsContent value="external" className="mt-4 space-y-4">
                <FormField label="Email" required error={guestForm.formState.errors.email?.message}>
                  <Input type="email" autoComplete="email" {...guestForm.register('email')} />
                </FormField>
                <FormField
                  label="Full name"
                  required
                  error={guestForm.formState.errors.fullName?.message}
                >
                  <Input {...guestForm.register('fullName')} />
                </FormField>
                <FormField label="Title (optional)">
                  <AppSelect
                    value={guestForm.watch('title') || ''}
                    onValueChange={(value) =>
                      guestForm.setValue('title', value as InviteReporterFormValues['title'])
                    }
                    placeholder="Select title"
                    allowNone
                    noneLabel="No title"
                    noneValue=""
                    options={[
                      { value: 'Partner', label: 'Partner' },
                      { value: 'Director', label: 'Director' },
                      { value: 'HeadOfDepartment', label: 'Head of department' },
                      { value: 'ManagingConsultant', label: 'Managing consultant' },
                    ]}
                  />
                </FormField>
                <div className="flex justify-end">
                  <LoadingButton
                    type="button"
                    loading={invite.isPending}
                    onClick={guestForm.handleSubmit(inviteExternal)}
                  >
                    Invite guest
                  </LoadingButton>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={Boolean(requestUser)}
        onOpenChange={(o) => {
          if (!o) {
            setRequestUser(null);
            setRequestNote('');
          }
        }}
        title="Request a report"
        description={
          requestUser
            ? `Ask ${requestUser.fullName} for a report now. They can still submit anytime.`
            : undefined
        }
        maxWidthClass="sm:max-w-md"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setRequestUser(null)}>
              Cancel
            </Button>
            <LoadingButton
              type="button"
              loading={requestReport.isPending}
              onClick={() => void sendRequest()}
            >
              Send request
            </LoadingButton>
          </>
        }
      >
        <FormField label="Note (optional)">
          <Textarea
            rows={3}
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            placeholder="e.g. Please cover WIP and collections for this week"
          />
        </FormField>
      </FormDialog>
    </>
  );
}
