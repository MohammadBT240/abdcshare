'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { FormField, FormSection, LoadingButton, ProfilePhotoUpload, AppSelect, LookupSelect } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormCardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
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
import {
  useAssignDesignation,
  useDeactivateUser,
  useDepartments,
  useRoles,
  useUpdateUser,
  useUser,
} from '@/features/users/hooks/use-users';
import { uploadUserAvatar } from '@/features/users/lib/upload-user-avatar';
import {
  CREATABLE_ROLE_NAMES,
  updateUserSchema,
  type UpdateUserFormValues,
} from '@/features/users/schemas/user.schema';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { can } = useAuthContext();
  const user = useUser(id);
  const roles = useRoles();
  const departments = useDepartments();
  const update = useUpdateUser(id);
  const deactivate = useDeactivateUser();
  const designation = useAssignDesignation(id);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      surname: '',
      email: '',
      roleId: '',
      partnerDesignation: 'none',
      titleId: '',
      genderId: '',
      maritalStatusId: '',
      departmentId: '',
      phoneNumber: '',
      officialAddress: '',
      residentialAddress: '',
      isActive: true,
    },
  });

  const editableRoles = useMemo(() => {
    const creatable = (roles.data ?? []).filter((r) =>
      (CREATABLE_ROLE_NAMES as readonly string[]).includes(r.roleName),
    );
    const current = roles.data?.find((r) => r.roleName === user.data?.role);
    if (current && !creatable.some((r) => r.id === current.id)) {
      return [...creatable, current];
    }
    return creatable;
  }, [roles.data, user.data?.role]);

  useEffect(() => {
    if (!user.data || !roles.data) return;
    const role = roles.data.find((r) => r.roleName === user.data.role);
    const isSa = role?.roleName === 'Super Admin';
    form.reset({
      firstName: user.data.firstName,
      middleName: user.data.middleName ?? '',
      surname: user.data.surname,
      email: user.data.email,
      roleId: role ? String(role.id) : '',
      partnerDesignation:
        isSa && user.data.partnerDesignation ? user.data.partnerDesignation : 'none',
      titleId: user.data.titleId ? String(user.data.titleId) : '',
      genderId: user.data.genderId ? String(user.data.genderId) : '',
      maritalStatusId: user.data.maritalStatusId ? String(user.data.maritalStatusId) : '',
      departmentId: user.data.departmentId ? String(user.data.departmentId) : '',
      phoneNumber: user.data.phoneNumber ?? '',
      officialAddress: user.data.officialAddress ?? '',
      residentialAddress: user.data.residentialAddress ?? '',
      isActive: user.data.isActive,
    });
    setAvatarFile(null);
    setHydratedFor(user.data.id);
  }, [user.data, roles.data, form]);

  const roleId = form.watch('roleId');
  const selectedRoleName = editableRoles.find((r) => String(r.id) === roleId)?.roleName;
  const isSuperAdmin = selectedRoleName === 'Super Admin';
  const isClientRole = selectedRoleName === 'Client' || user.data?.role === 'Client';

  // Only clear designation after a role is selected — never while roleId is still empty
  // (that race wiped PrincipalPartner on first paint).
  useEffect(() => {
    if (!roleId || isSuperAdmin) return;
    if (form.getValues('partnerDesignation') !== 'none') {
      form.setValue('partnerDesignation', 'none');
    }
  }, [isSuperAdmin, roleId, form]);

  const firstName = form.watch('firstName');
  const surname = form.watch('surname');
  const initials = useMemo(() => {
    return `${firstName?.trim()?.[0] ?? ''}${surname?.trim()?.[0] ?? ''}` || '?';
  }, [firstName, surname]);

  async function onSubmit(values: UpdateUserFormValues) {
    try {
      const body: Record<string, unknown> = {
        firstName: values.firstName.trim(),
        surname: values.surname.trim(),
        email: values.email.trim(),
        roleId: Number(values.roleId),
        isActive: values.isActive,
        middleName: values.middleName?.trim() || null,
        titleId: values.titleId ? Number(values.titleId) : null,
        genderId: values.genderId ? Number(values.genderId) : null,
        maritalStatusId: values.maritalStatusId ? Number(values.maritalStatusId) : null,
        departmentId: values.departmentId ? Number(values.departmentId) : null,
        phoneNumber: values.phoneNumber?.trim() || null,
        officialAddress: values.officialAddress?.trim() || null,
        residentialAddress: values.residentialAddress?.trim() || null,
      };

      await update.mutateAsync(body);

      if (isSuperAdmin) {
        const next =
          values.partnerDesignation === 'none' ? null : values.partnerDesignation;
        const current = user.data?.partnerDesignation ?? null;
        if (next !== current) {
          try {
            await designation.mutateAsync({ designation: next });
          } catch (err) {
            toast.error(
              err instanceof BffClientError
                ? err.message
                : 'Profile saved but partner designation could not be updated',
            );
            await user.refetch();
            return;
          }
        }
      }

      if (avatarFile) {
        try {
          await uploadUserAvatar(id, avatarFile);
          setAvatarFile(null);
          await qc.invalidateQueries({ queryKey: ['users'] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Profile saved but photo upload failed');
          await user.refetch();
          return;
        }
      }

      toast.success('User updated');
      await user.refetch();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Update failed');
    }
  }

  async function onDeactivate() {
    try {
      await deactivate.mutateAsync(id);
      toast.success('User deactivated');
      await user.refetch();
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Deactivate failed');
    }
  }

  const lookupsReady = !roles.isPending && !departments.isPending;

  if (user.isPending || !lookupsReady || hydratedFor !== id) return <FormCardSkeleton />;
  if (user.isError || !user.data) {
    return <p className="text-destructive">User not found</p>;
  }

  const record = user.data;
  const canManage = can('user:manage');
  const submitting = update.isPending || designation.isPending;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageToolbar
        title={record.fullName}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Users', href: '/admin/users' },
          { label: record.fullName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={record.isActive ? 'success' : 'secondary'}>
              {record.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {record.partnerDesignation ? (
              <Badge variant="secondary">
                {record.partnerDesignation === 'PrincipalPartner'
                  ? 'Principal Partner'
                  : 'Partner'}
              </Badge>
            ) : null}
          </div>
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <FormSection title="Profile">
              <ProfilePhotoUpload
                value={avatarFile}
                onChange={setAvatarFile}
                existingUrl={record.avatarUrl}
                initials={initials}
              />
            </FormSection>

            <FormSection title="Identity" description="Name and demographic details.">
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Title">
                  <LookupSelect
                    type="titles"
                    value={form.watch('titleId')}
                    onValueChange={(v) => form.setValue('titleId', v)}
                    allowNone
                    placeholder="Optional"
                    disabled={!canManage}
                  />
                </FormField>
                <FormField label="Phone">
                  <Input {...form.register('phoneNumber')} disabled={!canManage} />
                </FormField>
                <FormField label="First name" required>
                  <Input {...form.register('firstName')} disabled={!canManage} />
                </FormField>
                <FormField label="Middle name">
                  <Input {...form.register('middleName')} disabled={!canManage} />
                </FormField>
                <FormField label="Surname" required>
                  <Input {...form.register('surname')} disabled={!canManage} />
                </FormField>
                <FormField label="Email" required description="Login username for this account.">
                  <Input type="email" {...form.register('email')} disabled={!canManage} />
                </FormField>
                <FormField label="Gender">
                  <LookupSelect
                    type="genders"
                    value={form.watch('genderId')}
                    onValueChange={(v) => form.setValue('genderId', v)}
                    allowNone
                    placeholder="Optional"
                    disabled={!canManage}
                  />
                </FormField>
                <FormField label="Marital status">
                  <LookupSelect
                    type="marital-statuses"
                    value={form.watch('maritalStatusId')}
                    onValueChange={(v) => form.setValue('maritalStatusId', v)}
                    allowNone
                    placeholder="Optional"
                    disabled={!canManage}
                  />
                </FormField>
              </div>
            </FormSection>
          </div>

          <div className="space-y-5">
            <FormSection
              title="Role & access"
              description={
                isClientRole
                  ? 'Client portal accounts are managed with the linked client organisation.'
                  : 'Partner designation tags apply only to Super Admins.'
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Role" required>
                  <AppSelect
                    value={form.watch('roleId') || undefined}
                    onValueChange={(v) => form.setValue('roleId', v, { shouldValidate: true })}
                    options={editableRoles.map((r) => ({ value: String(r.id), label: r.roleName }))}
                    placeholder="Select role"
                    disabled={!canManage || isClientRole}
                  />
                </FormField>
                <FormField
                  label="Partner designation"
                  description={
                    isSuperAdmin
                      ? 'At most one Principal Partner firm-wide.'
                      : 'Select Super Admin as role to enable tagging.'
                  }
                >
                  <AppSelect
                    value={form.watch('partnerDesignation')}
                    onValueChange={(v) =>
                      form.setValue(
                        'partnerDesignation',
                        v as UpdateUserFormValues['partnerDesignation'],
                      )
                    }
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'Partner', label: 'Partner' },
                      { value: 'PrincipalPartner', label: 'Principal Partner' },
                    ]}
                    disabled={!canManage || !isSuperAdmin}
                  />
                </FormField>
                <FormField label="Department">
                  <AppSelect
                    value={form.watch('departmentId')}
                    onValueChange={(v) => form.setValue('departmentId', v)}
                    options={(departments.data ?? []).map((d) => ({
                      value: String(d.id),
                      label: d.name,
                    }))}
                    allowNone
                    placeholder="Optional"
                    disabled={!canManage}
                    isLoading={departments.isPending}
                  />
                </FormField>
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
              </div>
            </FormSection>

            <FormSection title="Addresses" description="Optional.">
              <div className="grid gap-3">
                <FormField label="Official address">
                  <Textarea rows={2} {...form.register('officialAddress')} disabled={!canManage} />
                </FormField>
                <FormField label="Residential address">
                  <Textarea
                    rows={2}
                    {...form.register('residentialAddress')}
                    disabled={!canManage}
                  />
                </FormField>
              </div>
            </FormSection>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          {canManage ? (
            <>
              <LoadingButton type="submit" loading={submitting}>
                Save changes
              </LoadingButton>
              {record.isActive ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline">
                      Deactivate
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Deactivate user?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {record.fullName} will no longer be able to sign in.
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
              ) : null}
            </>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => router.push('/admin/users')}>
            Back to list
          </Button>
        </div>
      </form>
    </div>
  );
}
