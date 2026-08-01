'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  AppSelect,
  FormDialog,
  FormField,
  FormSection,
  LoadingButton,
  LookupSelect,
  ProfilePhotoUpload,
} from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import {
  useAssignDesignation,
  useCreateUser,
  useDepartments,
  useRoles,
} from '@/features/users/hooks/use-users';
import { uploadUserAvatar } from '@/features/users/lib/upload-user-avatar';
import {
  CREATABLE_ROLE_NAMES,
  createUserSchema,
  type CreateUserFormValues,
} from '@/features/users/schemas/user.schema';

const emptyValues: CreateUserFormValues = {
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
  clientId: '',
  phoneNumber: '',
  officialAddress: '',
  residentialAddress: '',
};

interface AddUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (userId: string) => void;
}

export function AddUserDialog({ open, onOpenChange, onCreated }: AddUserDialogProps) {
  const qc = useQueryClient();
  const create = useCreateUser();
  const assignDesignation = useAssignDesignation();
  const roles = useRoles();
  const departments = useDepartments();
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (!open) {
      form.reset(emptyValues);
      setAvatarFile(null);
    }
  }, [open, form]);

  const creatableRoles = useMemo(
    () =>
      (roles.data ?? []).filter((r) =>
        (CREATABLE_ROLE_NAMES as readonly string[]).includes(r.roleName),
      ),
    [roles.data],
  );

  const roleId = form.watch('roleId');
  const selectedRoleName = creatableRoles.find((r) => String(r.id) === roleId)?.roleName;
  const isSuperAdmin = selectedRoleName === 'Super Admin';

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

  async function onSubmit(values: CreateUserFormValues) {
    try {
      const body: Record<string, unknown> = {
        firstName: values.firstName.trim(),
        surname: values.surname.trim(),
        email: values.email.trim(),
        roleId: Number(values.roleId),
      };
      if (values.middleName?.trim()) body.middleName = values.middleName.trim();
      if (values.titleId) body.titleId = Number(values.titleId);
      if (values.genderId) body.genderId = Number(values.genderId);
      if (values.maritalStatusId) body.maritalStatusId = Number(values.maritalStatusId);
      if (values.departmentId) body.departmentId = Number(values.departmentId);
      if (values.phoneNumber?.trim()) body.phoneNumber = values.phoneNumber.trim();
      if (values.officialAddress?.trim()) body.officialAddress = values.officialAddress.trim();
      if (values.residentialAddress?.trim()) body.residentialAddress = values.residentialAddress.trim();

      const user = await create.mutateAsync(body);

      const warnings: string[] = [];

      if (isSuperAdmin && values.partnerDesignation !== 'none') {
        try {
          await assignDesignation.mutateAsync({
            id: user.id,
            designation: values.partnerDesignation,
          });
        } catch (err) {
          warnings.push(
            err instanceof BffClientError
              ? err.message
              : 'Partner designation could not be set — assign it on the user page',
          );
        }
      }

      if (avatarFile) {
        try {
          await uploadUserAvatar(user.id, avatarFile);
          await qc.invalidateQueries({ queryKey: ['users'] });
        } catch (err) {
          warnings.push(err instanceof Error ? err.message : 'Photo upload failed');
        }
      }

      if (warnings.length > 0) {
        toast.warning(`User created — ${warnings.join('; ')}`);
      } else {
        toast.success('User created — credentials emailed');
      }
      onOpenChange(false);
      onCreated?.(user.id);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not create user');
    }
  }

  const lookupsReady = !roles.isPending && !departments.isPending;

  const submitting = create.isPending || assignDesignation.isPending;

  const roleOptions = useMemo(
    () => creatableRoles.map((r) => ({ value: String(r.id), label: r.roleName })),
    [creatableRoles],
  );

  const departmentOptions = useMemo(
    () => (departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name })),
    [departments.data],
  );

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add user"
      description="Create a firm user account. Credentials are emailed automatically. Client portal logins are created from Clients."
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="add-user-form"
            loading={submitting}
            disabled={!lookupsReady}
          >
            Create user
          </LoadingButton>
        </>
      }
    >
      <form id="add-user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <FormSection title="Profile">
              <ProfilePhotoUpload
                value={avatarFile}
                onChange={setAvatarFile}
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
                  />
                </FormField>
                <FormField label="Phone">
                  <Input {...form.register('phoneNumber')} />
                </FormField>
                <FormField label="First name" required error={form.formState.errors.firstName?.message}>
                  <Input {...form.register('firstName')} />
                </FormField>
                <FormField label="Middle name">
                  <Input {...form.register('middleName')} />
                </FormField>
                <FormField label="Surname" required error={form.formState.errors.surname?.message}>
                  <Input {...form.register('surname')} />
                </FormField>
                <FormField
                  label="Email"
                  required
                  description="Login credentials are emailed here."
                  error={form.formState.errors.email?.message}
                >
                  <Input type="email" {...form.register('email')} />
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
              title="Role & access"
              description="Partner designation tags apply only to Super Admins."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Role" required error={form.formState.errors.roleId?.message}>
                  <AppSelect
                    value={form.watch('roleId') || undefined}
                    onValueChange={(v) => form.setValue('roleId', v, { shouldValidate: true })}
                    options={roleOptions}
                    placeholder="Select role"
                    isLoading={!lookupsReady}
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
                        v as CreateUserFormValues['partnerDesignation'],
                      )
                    }
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'Partner', label: 'Partner' },
                      { value: 'PrincipalPartner', label: 'Principal Partner' },
                    ]}
                    disabled={!isSuperAdmin}
                  />
                </FormField>
                <FormField label="Department" className="sm:col-span-2">
                  <AppSelect
                    value={form.watch('departmentId')}
                    onValueChange={(v) => form.setValue('departmentId', v)}
                    options={departmentOptions}
                    allowNone
                    placeholder="Optional"
                    isLoading={departments.isPending}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Addresses" description="Optional.">
              <div className="grid gap-3">
                <FormField label="Official address">
                  <Textarea rows={2} {...form.register('officialAddress')} />
                </FormField>
                <FormField label="Residential address">
                  <Textarea rows={2} {...form.register('residentialAddress')} />
                </FormField>
              </div>
            </FormSection>
          </div>
        </div>
      </form>
    </FormDialog>
  );
}
