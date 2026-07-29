'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FormCardSkeleton } from '@/components/skeletons';
import { useAuthContext } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { bffApi, BffClientError } from '@/lib/bff/client';

interface CompanyProfile {
  id: number;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  updatedAt: string;
}

export default function CompanyProfilePage() {
  const { can } = useAuthContext();
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ['company-profile'],
    queryFn: () => bffApi<CompanyProfile>('/api/company-profile'),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<CompanyProfile>('/api/company-profile', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['company-profile'] });
    },
  });

  const form = useForm({
    defaultValues: { name: '', email: '', phone: '', address: '' },
  });

  useEffect(() => {
    if (!profile.data) return;
    form.reset({
      name: profile.data.name ?? '',
      email: profile.data.email ?? '',
      phone: profile.data.phone ?? '',
      address: profile.data.address ?? '',
    });
  }, [profile.data, form]);

  if (profile.isPending) return <FormCardSkeleton />;

  if (profile.isError) {
    return (
      <div>
        <PageToolbar
          title="Company profile"
          breadcrumbs={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Settings' },
            { label: 'Company profile' },
          ]}
        />
        <Card>
          <CardContent className="py-8 text-sm text-destructive">
            {profile.error instanceof BffClientError
              ? profile.error.message
              : 'Failed to load company profile'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageToolbar
        title="Company profile"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Settings' },
          { label: 'Company profile' },
        ]}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Firm details</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!can('company-profile:manage')) return;
              try {
                await save.mutateAsync(values);
                toast.success('Company profile saved');
              } catch (err) {
                toast.error(err instanceof BffClientError ? err.message : 'Save failed');
              }
            })}
            className="grid max-w-xl gap-4"
          >
            <div className="space-y-2">
              <Label>Name</Label>
              <Input {...form.register('name')} disabled={!can('company-profile:manage')} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...form.register('email')} disabled={!can('company-profile:manage')} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...form.register('phone')} disabled={!can('company-profile:manage')} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea {...form.register('address')} disabled={!can('company-profile:manage')} />
            </div>
            {can('company-profile:manage') ? (
              <Button type="submit" disabled={save.isPending} className="w-fit">
                Save
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
