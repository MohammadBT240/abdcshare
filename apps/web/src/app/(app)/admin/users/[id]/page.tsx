'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormCardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { updateUserSchema, type UpdateUserFormValues } from '@/features/users/schemas/user.schema';

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can, user: me } = useAuthContext();
  const user = useUser(id);
  const roles = useRoles();
  const departments = useDepartments();
  const update = useUpdateUser(id);
  const deactivate = useDeactivateUser();
  const designation = useAssignDesignation(id);
  const isSuperAdmin = me?.role === 'Super Admin';

  const form = useForm<UpdateUserFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { fullName: '', roleId: '', departmentId: '', isActive: true },
  });

  useEffect(() => {
    if (!user.data || !roles.data) return;
    const role = roles.data.find((r) => r.roleName === user.data.role);
    form.reset({
      fullName: user.data.fullName,
      roleId: role ? String(role.id) : '',
      departmentId: user.data.departmentId ? String(user.data.departmentId) : '',
      isActive: user.data.isActive,
    });
  }, [user.data, roles.data, form]);

  async function onSubmit(values: UpdateUserFormValues) {
    try {
      const body: Record<string, unknown> = {
        fullName: values.fullName,
        roleId: Number(values.roleId),
        isActive: values.isActive,
      };
      if (values.departmentId) body.departmentId = Number(values.departmentId);
      await update.mutateAsync(body);
      toast.success('User updated');
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

  async function onDesignation(value: string) {
    try {
      const designationValue =
        value === 'none' ? null : (value as 'PrincipalPartner' | 'Partner');
      await designation.mutateAsync(designationValue);
      toast.success('Designation updated');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Designation update failed');
    }
  }

  if (user.isPending || roles.isPending) return <FormCardSkeleton />;
  if (user.isError || !user.data) {
    return <p className="text-destructive">User not found</p>;
  }

  const record = user.data;

  return (
    <div className="space-y-6">
      <PageToolbar
        title={record.fullName}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Users', href: '/admin/users' },
          { label: record.fullName },
        ]}
        actions={
          <Badge variant={record.isActive ? 'success' : 'secondary'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Email:</span> {record.email}
          </p>
          <p>
            <span className="text-muted-foreground">Role:</span> {record.role}
          </p>
          {record.partnerDesignation ? (
            <p>
              <span className="text-muted-foreground">Designation:</span> {record.partnerDesignation}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {can('user:manage') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input {...form.register('fullName')} />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={form.watch('roleId')} onValueChange={(v) => form.setValue('roleId', v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(roles.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.roleName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select
                  value={form.watch('departmentId') || 'none'}
                  onValueChange={(v) => form.setValue('departmentId', v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue />
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
              </div>
              <div className="space-y-2">
                <Label>Active</Label>
                <Select
                  value={form.watch('isActive') ? 'true' : 'false'}
                  onValueChange={(v) => form.setValue('isActive', v === 'true')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isSuperAdmin ? (
                <div className="space-y-2 md:col-span-2">
                  <Label>Partner designation</Label>
                  <Select
                    value={record.partnerDesignation ?? 'none'}
                    onValueChange={(v) => void onDesignation(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="PrincipalPartner">Principal Partner</SelectItem>
                      <SelectItem value="Partner">Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit" disabled={update.isPending}>
                  Save changes
                </Button>
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
                <Button type="button" variant="ghost" onClick={() => router.push('/admin/users')}>
                  Back to list
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
