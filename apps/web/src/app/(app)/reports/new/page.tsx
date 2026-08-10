'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/components/providers/auth-provider';
import { RequirePermission } from '@/components/auth/require-permission';
import {
  PartnerReportForm,
  toSavePayload,
} from '@/features/partner-reports/components/partner-report-form';
import {
  useCreatePartnerReport,
  useMyReportingStatus,
} from '@/features/partner-reports/hooks/use-partner-reports';
import {
  emptyReportValues,
  savePartnerReportSchema,
  type SavePartnerReportFormValues,
} from '@/features/partner-reports/schemas/report.schema';
import { BffClientError, bffApi } from '@/lib/bff/client';

function NewReportInner() {
  const router = useRouter();
  const { user } = useAuthContext();
  const create = useCreatePartnerReport();
  const myStatus = useMyReportingStatus();
  const form = useForm<SavePartnerReportFormValues>({
    resolver: zodResolver(savePartnerReportSchema),
    defaultValues: emptyReportValues,
  });

  useEffect(() => {
    if (user?.fullName) {
      form.setValue('reportingOfficerName', user.fullName);
    }
  }, [user?.fullName, form]);

  async function saveDraft() {
    const values = form.getValues();
    const parsed = savePartnerReportSchema.safeParse(values);
    if (!parsed.success) {
      await form.trigger();
      toast.error('Please complete the required fields');
      return;
    }
    try {
      const row = await create.mutateAsync(toSavePayload(parsed.data));
      toast.success('Draft saved');
      router.replace(`/reports/${row.id}`);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to save draft');
    }
  }

  async function submitReport() {
    const values = form.getValues();
    const parsed = savePartnerReportSchema.safeParse(values);
    if (!parsed.success) {
      await form.trigger();
      toast.error('Please complete the required fields');
      return;
    }
    try {
      const row = await create.mutateAsync(toSavePayload(parsed.data));
      await bffApi(`/api/partner-reports/${row.id}/submit`, { method: 'POST' });
      toast.success('Report submitted to the Principal');
      router.replace(`/reports/${row.id}`);
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to submit');
    }
  }

  return (
    <div className="space-y-5">
      <PageToolbar
        title="New report"
        description="Step through the report, save a draft anytime, submit on the last step"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'New' },
        ]}
        actions={
          <Button type="button" variant="outline" onClick={() => router.push('/reports')}>
            Cancel
          </Button>
        }
      />
      <PartnerReportForm
        form={form}
        financialsEnabled={myStatus.data?.financialsEnabled ?? true}
        onSaveDraft={saveDraft}
        onSubmitReport={submitReport}
        saving={create.isPending}
        submitting={create.isPending}
      />
    </div>
  );
}

export default function NewReportPage() {
  return (
    <RequirePermission permission="partner-report:submit">
      <NewReportInner />
    </RequirePermission>
  );
}
