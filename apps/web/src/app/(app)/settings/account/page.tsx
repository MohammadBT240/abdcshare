'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  FormField,
  FormSection,
  LoadingButton,
  ProfilePhotoUpload,
  LookupSelect,
} from '@/components/forms';
import { FormCardSkeleton } from '@/components/skeletons';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ChangePasswordForm } from '@/features/auth/components/change-password-form';
import { AUTH_ME_KEY } from '@/features/auth/hooks/use-auth';
import { useDepartments } from '@/features/users/hooks/use-users';
import {
  useMeProfile,
  useUpdateMe,
  ME_PROFILE_KEY,
} from '@/features/settings/hooks/use-me-profile';
import { uploadMeAvatar } from '@/features/settings/lib/upload-me-avatar';
import {
  updateMeSchema,
  type UpdateMeFormValues,
} from '@/features/settings/schemas/me.schema';
import { BffClientError } from '@/lib/bff/client';

export default function SettingsAccountPage() {
  const qc = useQueryClient();
  const me = useMeProfile();
  const departments = useDepartments();
  const update = useUpdateMe();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const form = useForm<UpdateMeFormValues>({
    resolver: zodResolver(updateMeSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      surname: '',
      titleId: '',
      genderId: '',
      maritalStatusId: '',
      phoneNumber: '',
      officialAddress: '',
      residentialAddress: '',
    },
  });

  useEffect(() => {
    if (!me.data) return;
    form.reset({
      firstName: me.data.firstName,
      middleName: me.data.middleName ?? '',
      surname: me.data.surname,
      titleId: me.data.titleId ? String(me.data.titleId) : '',
      genderId: me.data.genderId ? String(me.data.genderId) : '',
      maritalStatusId: me.data.maritalStatusId ? String(me.data.maritalStatusId) : '',
      phoneNumber: me.data.phoneNumber ?? '',
      officialAddress: me.data.officialAddress ?? '',
      residentialAddress: me.data.residentialAddress ?? '',
    });
    setAvatarFile(null);
    setHydrated(true);
  }, [me.data, form]);

  const firstName = form.watch('firstName');
  const surname = form.watch('surname');
  const initials = useMemo(() => {
    return `${firstName?.trim()?.[0] ?? ''}${surname?.trim()?.[0] ?? ''}` || '?';
  }, [firstName, surname]);

  const departmentName = useMemo(() => {
    if (!me.data?.departmentId) return '—';
    return (
      departments.data?.find((d) => d.id === me.data.departmentId)?.name ?? '—'
    );
  }, [departments.data, me.data?.departmentId]);

  async function onSubmit(values: UpdateMeFormValues) {
    try {
      await update.mutateAsync({
        firstName: values.firstName.trim(),
        surname: values.surname.trim(),
        middleName: values.middleName?.trim() || null,
        titleId: values.titleId ? Number(values.titleId) : null,
        genderId: values.genderId ? Number(values.genderId) : null,
        maritalStatusId: values.maritalStatusId ? Number(values.maritalStatusId) : null,
        phoneNumber: values.phoneNumber?.trim() || null,
        officialAddress: values.officialAddress?.trim() || null,
        residentialAddress: values.residentialAddress?.trim() || null,
      });

      if (avatarFile) {
        try {
          await uploadMeAvatar(avatarFile);
          setAvatarFile(null);
          await Promise.all([
            qc.invalidateQueries({ queryKey: ME_PROFILE_KEY }),
            qc.invalidateQueries({ queryKey: AUTH_ME_KEY }),
          ]);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Profile saved but photo upload failed');
          await me.refetch();
          return;
        }
      }

      toast.success('Profile updated');
      await me.refetch();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Update failed');
    }
  }

  if (me.isPending || !hydrated) return <FormCardSkeleton />;
  if (me.isError || !me.data) {
    return <p className="text-sm text-destructive">Failed to load your profile.</p>;
  }

  const record = me.data;
  const partnerLabel =
    record.partnerDesignation === 'PrincipalPartner'
      ? 'Principal Partner'
      : record.partnerDesignation === 'Partner'
        ? 'Partner'
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Account</h2>
        <p className="text-sm text-muted-foreground">
          Update your photo, personal details, and password.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <FormSection title="Profile photo">
              <ProfilePhotoUpload
                value={avatarFile}
                onChange={setAvatarFile}
                existingUrl={record.avatarUrl}
                initials={initials}
              />
            </FormSection>

            <FormSection title="Identity" description="Name and contact details.">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Title">
                  <LookupSelect
                    type="titles"
                    value={form.watch('titleId')}
                    onValueChange={(v) => form.setValue('titleId', v)}
                    allowNone
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="Phone">
                  <Input {...form.register('phoneNumber')} />
                </FormField>
                <FormField label="First name" required>
                  <Input {...form.register('firstName')} />
                  {form.formState.errors.firstName ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.firstName.message}
                    </p>
                  ) : null}
                </FormField>
                <FormField label="Middle name">
                  <Input {...form.register('middleName')} />
                </FormField>
                <FormField label="Surname" required className="sm:col-span-2">
                  <Input {...form.register('surname')} />
                  {form.formState.errors.surname ? (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.surname.message}
                    </p>
                  ) : null}
                </FormField>
                <FormField label="Gender">
                  <LookupSelect
                    type="genders"
                    value={form.watch('genderId')}
                    onValueChange={(v) => form.setValue('genderId', v)}
                    allowNone
                    placeholder="Optional"
                  />
                </FormField>
                <FormField label="Marital status">
                  <LookupSelect
                    type="marital-statuses"
                    value={form.watch('maritalStatusId')}
                    onValueChange={(v) => form.setValue('maritalStatusId', v)}
                    allowNone
                    placeholder="Optional"
                  />
                </FormField>
              </div>
            </FormSection>
          </div>

          <div className="space-y-5">
            <FormSection
              title="Account"
              description="Managed by your administrator — contact them to change these."
            >
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Email
                  </dt>
                  <dd className="mt-0.5 truncate">{record.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Role
                  </dt>
                  <dd className="mt-0.5">
                    {record.role}
                    {partnerLabel ? ` · ${partnerLabel}` : ''}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Department
                  </dt>
                  <dd className="mt-0.5">{departmentName}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </dt>
                  <dd className="mt-0.5">{record.isActive ? 'Active' : 'Inactive'}</dd>
                </div>
              </dl>
            </FormSection>

            <FormSection title="Addresses">
              <div className="space-y-3">
                <FormField label="Official address">
                  <Textarea rows={3} {...form.register('officialAddress')} />
                </FormField>
                <FormField label="Residential address">
                  <Textarea rows={3} {...form.register('residentialAddress')} />
                </FormField>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex justify-end">
          <LoadingButton type="submit" loading={update.isPending}>
            Save changes
          </LoadingButton>
        </div>
      </form>

      <FormSection
        title="Security"
        description="Changing your password signs you out of all sessions."
      >
        <div className="max-w-md">
          <ChangePasswordForm />
        </div>
      </FormSection>
    </div>
  );
}
