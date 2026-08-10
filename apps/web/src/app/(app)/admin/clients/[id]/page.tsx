'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FormField, FormSection, LoadingButton, ProfilePhotoUpload, AppSelect, DatePicker } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormCardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { clientTypeKind } from '@/features/clients/constants';
import {
  useClient,
  useDeactivateClient,
  useResetClientContactPassword,
  useUpdateClient,
} from '@/features/clients/hooks/use-clients';
import { ClientContactsPanel } from '@/features/clients/components/client-contacts-panel';
import { uploadUserAvatar } from '@/features/users/lib/upload-user-avatar';
import { format, isValid, parse } from 'date-fns';

interface EditClientFormValues {
  firstName: string;
  surname: string;
  companyName: string;
  companyRegisteredAddress: string;
  incorporationDate: string;
  incorporationNo: string;
  officialAddress: string;
  residentialAddress: string;
  email: string;
  phoneNumber: string;
  isActive: boolean;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuthContext();
  const canManage = can('client:manage');
  const client = useClient(id);
  const update = useUpdateClient(id);
  const deactivate = useDeactivateClient();
  const resetContactPassword = useResetClientContactPassword();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const form = useForm<EditClientFormValues>({
    defaultValues: {
      firstName: '',
      surname: '',
      companyName: '',
      companyRegisteredAddress: '',
      incorporationDate: '',
      incorporationNo: '',
      officialAddress: '',
      residentialAddress: '',
      email: '',
      phoneNumber: '',
      isActive: true,
    },
  });

  useEffect(() => {
    if (!client.data) return;
    const record = client.data;
    const kind = clientTypeKind(record.clientType);
    form.reset({
      firstName:
        kind === 'individual'
          ? (record.primaryContactFirstName ?? '')
          : '',
      surname:
        kind === 'individual'
          ? (record.primaryContactSurname ?? '')
          : '',
      companyName: record.companyName?.trim() || record.name,
      companyRegisteredAddress: record.companyRegisteredAddress ?? '',
      incorporationDate: toDateInput(record.incorporationDate),
      incorporationNo: record.incorporationNo ?? '',
      officialAddress: record.officialAddress ?? '',
      residentialAddress: record.residentialAddress ?? '',
      email: record.email ?? '',
      phoneNumber: record.phoneNumber ?? '',
      isActive: record.isActive,
    });
    setAvatarFile(null);
    setHydratedFor(record.id);
  }, [client.data, form]);

  const kind = clientTypeKind(client.data?.clientType);
  const isIndividual = kind === 'individual';
  const isCorporate = kind === 'corporate';

  const firstName = form.watch('firstName');
  const surname = form.watch('surname');

  const initials = useMemo(() => {
    if (isIndividual) {
      return `${firstName?.trim()?.[0] ?? ''}${surname?.trim()?.[0] ?? ''}` || '?';
    }
    const record = client.data;
    return (
      `${record?.primaryContactFirstName?.trim()?.[0] ?? ''}${record?.primaryContactSurname?.trim()?.[0] ?? ''}` ||
      '?'
    );
  }, [firstName, surname, isIndividual, client.data]);

  async function onSubmit(values: EditClientFormValues) {
    try {
      const body: Record<string, unknown> = {
        isActive: values.isActive,
        officialAddress: values.officialAddress.trim() || null,
        email: values.email.trim() || null,
        phoneNumber: values.phoneNumber.trim() || null,
      };

      if (isIndividual) {
        const first = values.firstName.trim();
        const last = values.surname.trim();
        body.name = [first, last].filter(Boolean).join(' ');
        body.residentialAddress = values.residentialAddress.trim() || null;
        body.contact = {
          firstName: first,
          surname: last,
          email: values.email.trim(),
          phoneNumber: values.phoneNumber.trim() || null,
        };
      }

      if (isCorporate) {
        const companyName = values.companyName.trim();
        body.name = companyName;
        body.companyName = companyName || null;
        body.companyRegisteredAddress = values.companyRegisteredAddress.trim() || null;
        body.incorporationNo = values.incorporationNo.trim() || null;
        body.incorporationDate = values.incorporationDate || null;
        // Portal contacts are managed in the Contacts panel — do not overwrite primary here.
      }

      await update.mutateAsync(body);

      if (avatarFile && client.data?.primaryContactId) {
        try {
          await uploadUserAvatar(client.data.primaryContactId, avatarFile);
          setAvatarFile(null);
          await qc.invalidateQueries({ queryKey: ['clients'] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Profile saved but photo upload failed');
          await client.refetch();
          return;
        }
      }

      toast.success('Client updated');
      await client.refetch();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Update failed');
    }
  }

  async function onDeactivate() {
    try {
      await deactivate.mutateAsync(id);
      toast.success('Client deactivated');
      await client.refetch();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Deactivate failed');
    }
  }

  async function onResetContactPassword() {
    try {
      await resetContactPassword.mutateAsync(id);
      toast.success(
        `New temporary password emailed to ${
          client.data?.primaryContactEmail ?? client.data?.email ?? 'the contact'
        }`,
      );
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Password reset failed');
    }
  }

  if (client.isPending || hydratedFor !== id) return <FormCardSkeleton />;
  if (client.isError || !client.data) {
    return <p className="text-destructive">Client not found</p>;
  }

  const record = client.data;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageToolbar
        title={record.name}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Clients', href: '/admin/clients' },
          { label: record.name },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={record.isActive} />
            {record.clientType ? <Badge variant="secondary">{record.clientType}</Badge> : null}
          </div>
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            {isIndividual ? (
              <FormSection title="Profile">
                <ProfilePhotoUpload
                  value={avatarFile}
                  onChange={setAvatarFile}
                  existingUrl={record.primaryContactAvatarUrl}
                  initials={initials}
                  description="Optional — applied to the individual’s portal login."
                />
              </FormSection>
            ) : null}

            {isIndividual ? (
              <FormSection
                title="Identity"
                description="The individual is also the portal login."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label="First name" required>
                    <Input {...form.register('firstName')} disabled={!canManage} />
                  </FormField>
                  <FormField label="Surname" required>
                    <Input {...form.register('surname')} disabled={!canManage} />
                  </FormField>
                  <FormField
                    label="Email"
                    required
                    description="Portal login username."
                    className="sm:col-span-2"
                  >
                    <Input type="email" {...form.register('email')} disabled={!canManage} />
                  </FormField>
                  <FormField label="Phone" className="sm:col-span-2">
                    <Input {...form.register('phoneNumber')} disabled={!canManage} />
                  </FormField>
                </div>
              </FormSection>
            ) : null}

            {isCorporate ? (
              <FormSection
                title="Organisation"
                description="Legal details for the company record."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    label="Company name"
                    required
                    description="Legal registered name — also used in lists and reports."
                    className="sm:col-span-2"
                  >
                    <Input {...form.register('companyName')} disabled={!canManage} />
                  </FormField>
                  <FormField label="Incorporation no.">
                    <Input {...form.register('incorporationNo')} disabled={!canManage} />
                  </FormField>
                  <FormField label="Incorporation date">
                    <DatePicker
                      value={(() => {
                        const raw = form.watch('incorporationDate');
                        if (!raw) return undefined;
                        const d = parse(raw, 'yyyy-MM-dd', new Date());
                        return isValid(d) ? d : undefined;
                      })()}
                      onChange={(d) =>
                        form.setValue('incorporationDate', d ? format(d, 'yyyy-MM-dd') : '')
                      }
                      disabled={!canManage}
                    />
                  </FormField>
                  <FormField label="Client email">
                    <Input type="email" {...form.register('email')} disabled={!canManage} />
                  </FormField>
                  <FormField label="Client phone">
                    <Input {...form.register('phoneNumber')} disabled={!canManage} />
                  </FormField>
                </div>
              </FormSection>
            ) : null}

            <FormSection title="Addresses" description="Optional.">
              <div className="grid gap-3">
                {isCorporate ? (
                  <FormField label="Registered address">
                    <Textarea
                      rows={2}
                      {...form.register('companyRegisteredAddress')}
                      disabled={!canManage}
                    />
                  </FormField>
                ) : null}
                {isIndividual ? (
                  <FormField label="Residential address">
                    <Textarea
                      rows={2}
                      {...form.register('residentialAddress')}
                      disabled={!canManage}
                    />
                  </FormField>
                ) : null}
                <FormField label="Official address">
                  <Textarea rows={2} {...form.register('officialAddress')} disabled={!canManage} />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Status">
              <FormField label="Status">
                <AppSelect
                  value={form.watch('isActive') ? 'true' : 'false'}
                  onValueChange={(v) => form.setValue('isActive', v === 'true')}
                  options={[
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                  ]}
                  disabled={!canManage}
                />
              </FormField>
            </FormSection>
          </div>

          <div className="space-y-5 lg:sticky lg:top-4">
            {isCorporate ? (
              <FormSection
                title="Primary photo"
                description="Shown for the primary contact’s portal profile."
              >
                <ProfilePhotoUpload
                  value={avatarFile}
                  onChange={setAvatarFile}
                  existingUrl={record.primaryContactAvatarUrl}
                  initials={initials}
                  description="Optional — applied to the primary contact."
                />
              </FormSection>
            ) : null}

            <ClientContactsPanel clientId={id} canManage={canManage} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canManage ? (
            <>
              <LoadingButton type="submit" loading={update.isPending}>
                Save changes
              </LoadingButton>
              {record.isActive ? (
                <>
                  {isIndividual ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="outline">
                          Reset & email password
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Reset contact password and email credentials?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            A new temporary password will be emailed to{' '}
                            {record.primaryContactEmail ?? record.email ?? 'the primary contact'}.
                            They must change it on next login.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void onResetContactPassword()}>
                            Reset & email
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : null}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" variant="outline">
                        Deactivate
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate client?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {record.name} will be marked inactive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onDeactivate()}>
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : null}
            </>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/clients')}>
            Back to list
          </Button>
        </div>
      </form>
    </div>
  );
}
