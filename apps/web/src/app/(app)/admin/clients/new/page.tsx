'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormCardSkeleton } from '@/components/skeletons';
import { BffClientError } from '@/lib/bff/client';
import { useCreateClient } from '@/features/clients/hooks/use-clients';
import { useLookup } from '@/features/users/hooks/use-users';

interface FormValues {
  name: string;
  clientTypeId: string;
  companyName: string;
  email: string;
  phoneNumber: string;
  contactFirstName: string;
  contactSurname: string;
  contactEmail: string;
  contactPhone: string;
}

export default function NewClientPage() {
  const router = useRouter();
  const create = useCreateClient();
  const clientTypes = useLookup('client-types');
  const form = useForm<FormValues>({
    defaultValues: {
      name: '',
      clientTypeId: '',
      companyName: '',
      email: '',
      phoneNumber: '',
      contactFirstName: '',
      contactSurname: '',
      contactEmail: '',
      contactPhone: '',
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const body: Record<string, unknown> = {
        name: values.name,
        contact: {
          firstName: values.contactFirstName,
          surname: values.contactSurname,
          email: values.contactEmail,
          phoneNumber: values.contactPhone || undefined,
        },
      };
      if (values.clientTypeId) body.clientTypeId = Number(values.clientTypeId);
      if (values.companyName) body.companyName = values.companyName;
      if (values.email) body.email = values.email;
      if (values.phoneNumber) body.phoneNumber = values.phoneNumber;

      const client = await create.mutateAsync(body);
      toast.success('Client created — primary contact credentials emailed');
      router.replace(`/admin/clients/${client.id}`);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Could not create client');
    }
  }

  if (clientTypes.isPending) return <FormCardSkeleton />;

  return (
    <div>
      <PageToolbar
        title="Add Client"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Clients', href: '/admin/clients' },
          { label: 'New' },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client & primary contact</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client name</Label>
              <Input {...form.register('name', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Client type</Label>
              <Select
                value={form.watch('clientTypeId') || 'none'}
                onValueChange={(v) => form.setValue('clientTypeId', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(clientTypes.data ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="md:col-span-2 mt-2 border-t border-border pt-4 text-sm font-semibold">
              Primary contact (provisions a Client login)
            </div>
            <div className="space-y-2">
              <Label>Contact first name</Label>
              <Input {...form.register('contactFirstName', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Contact surname</Label>
              <Input {...form.register('contactSurname', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input type="email" {...form.register('contactEmail', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Contact phone</Label>
              <Input {...form.register('contactPhone')} />
            </div>

            <div className="flex gap-2 md:col-span-2">
              <Button type="submit" disabled={create.isPending}>
                Create client
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push('/admin/clients')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
