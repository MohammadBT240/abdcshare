'use client';

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormCardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useClient,
  useDeactivateClient,
  useUpdateClient,
} from '@/features/clients/hooks/use-clients';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { can } = useAuthContext();
  const client = useClient(id);
  const update = useUpdateClient(id);
  const deactivate = useDeactivateClient();
  const form = useForm({
    defaultValues: { name: '', companyName: '', email: '', phoneNumber: '', isActive: true },
  });

  useEffect(() => {
    if (!client.data) return;
    form.reset({
      name: client.data.name,
      companyName: client.data.companyName ?? '',
      email: client.data.email ?? '',
      phoneNumber: client.data.phoneNumber ?? '',
      isActive: client.data.isActive,
    });
  }, [client.data, form]);

  async function onSubmit(values: {
    name: string;
    companyName: string;
    email: string;
    phoneNumber: string;
    isActive: boolean;
  }) {
    try {
      await update.mutateAsync({
        name: values.name,
        companyName: values.companyName || undefined,
        email: values.email || undefined,
        phoneNumber: values.phoneNumber || undefined,
        isActive: values.isActive,
      });
      toast.success('Client updated');
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Update failed');
    }
  }

  if (client.isPending) return <FormCardSkeleton />;
  if (!client.data) return <p className="text-destructive">Client not found</p>;

  return (
    <div className="space-y-6">
      <PageToolbar
        title={client.data.name}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Clients', href: '/admin/clients' },
          { label: client.data.name },
        ]}
        actions={
          <Badge variant={client.data.isActive ? 'success' : 'secondary'}>
            {client.data.isActive ? 'Active' : 'Inactive'}
          </Badge>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Type:</span> {client.data.clientType ?? '—'}
          </p>
          <p>
            <span className="text-muted-foreground">Primary contact:</span>{' '}
            {client.data.primaryContactName ?? '—'} ({client.data.primaryContactEmail ?? '—'})
          </p>
        </CardContent>
      </Card>

      {can('client:manage') ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input {...form.register('name', { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Company name</Label>
                <Input {...form.register('companyName')} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...form.register('email')} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...form.register('phoneNumber')} />
              </div>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <Button type="submit" disabled={update.isPending}>
                  Save changes
                </Button>
                {client.data.isActive ? (
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
                          {client.data.name} will be marked inactive.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await deactivate.mutateAsync(id);
                              toast.success('Client deactivated');
                              await client.refetch();
                            } catch (err) {
                              toast.error(
                                err instanceof BffClientError ? err.message : 'Deactivate failed',
                              );
                            }
                          }}
                        >
                          Deactivate
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                <Button type="button" variant="ghost" onClick={() => router.push('/admin/clients')}>
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
