'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormCardSkeleton } from '@/components/skeletons';
import { BffClientError } from '@/lib/bff/client';
import {
  useClientOptions,
  useCreateUser,
  useDepartments,
  useLookup,
  useRoles,
} from '@/features/users/hooks/use-users';
import { createUserSchema, type CreateUserFormValues } from '@/features/users/schemas/user.schema';

export default function NewUserPage() {
  const router = useRouter();
  const create = useCreateUser();
  const roles = useRoles();
  const departments = useDepartments();
  const titles = useLookup('titles');
  const genders = useLookup('genders');
  const marital = useLookup('marital-statuses');
  const clients = useClientOptions();

  const form = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      firstName: '',
      middleName: '',
      surname: '',
      email: '',
      roleId: '',
      phoneNumber: '',
      officialAddress: '',
      residentialAddress: '',
      clientId: '',
    },
  });

  async function onSubmit(values: CreateUserFormValues) {
    try {
      const body: Record<string, unknown> = {
        firstName: values.firstName,
        surname: values.surname,
        email: values.email,
        roleId: Number(values.roleId),
      };
      if (values.middleName) body.middleName = values.middleName;
      if (values.titleId) body.titleId = Number(values.titleId);
      if (values.genderId) body.genderId = Number(values.genderId);
      if (values.maritalStatusId) body.maritalStatusId = Number(values.maritalStatusId);
      if (values.departmentId) body.departmentId = Number(values.departmentId);
      if (values.clientId) body.clientId = values.clientId;
      if (values.phoneNumber) body.phoneNumber = values.phoneNumber;
      if (values.officialAddress) body.officialAddress = values.officialAddress;
      if (values.residentialAddress) body.residentialAddress = values.residentialAddress;

      const user = await create.mutateAsync(body);
      toast.success('User created — credentials emailed');
      router.replace(`/admin/users/${user.id}`);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not create user');
    }
  }

  const loadingLookups =
    roles.isPending || departments.isPending || titles.isPending || genders.isPending || marital.isPending;

  if (loadingLookups) return <FormCardSkeleton />;

  return (
    <div>
      <PageToolbar
        title="Add User"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Users', href: '/admin/users' },
          { label: 'New' },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <Field label="First name" error={form.formState.errors.firstName?.message}>
              <Input {...form.register('firstName')} />
            </Field>
            <Field label="Middle name">
              <Input {...form.register('middleName')} />
            </Field>
            <Field label="Surname" error={form.formState.errors.surname?.message}>
              <Input {...form.register('surname')} />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input type="email" {...form.register('email')} />
            </Field>

            <Field label="Role" error={form.formState.errors.roleId?.message}>
              <Select value={form.watch('roleId')} onValueChange={(v) => form.setValue('roleId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {(roles.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {r.roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Department">
              <Select
                value={form.watch('departmentId') || 'none'}
                onValueChange={(v) => form.setValue('departmentId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(departments.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Title">
              <Select
                value={form.watch('titleId') || 'none'}
                onValueChange={(v) => form.setValue('titleId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(titles.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Gender">
              <Select
                value={form.watch('genderId') || 'none'}
                onValueChange={(v) => form.setValue('genderId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(genders.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Marital status">
              <Select
                value={form.watch('maritalStatusId') || 'none'}
                onValueChange={(v) => form.setValue('maritalStatusId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(marital.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Linked client">
              <Select
                value={form.watch('clientId') || 'none'}
                onValueChange={(v) => form.setValue('clientId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(clients.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Phone">
              <Input {...form.register('phoneNumber')} />
            </Field>
            <Field label="Official address" className="md:col-span-2">
              <Input {...form.register('officialAddress')} />
            </Field>
            <Field label="Residential address" className="md:col-span-2">
              <Input {...form.register('residentialAddress')} />
            </Field>

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create user'}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  error,
  children,
  className,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
