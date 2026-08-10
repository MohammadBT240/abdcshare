'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { IconDownload } from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { StatusPill, formatStatusLabel, resolveStatusTone } from '@/components/data';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthContext } from '@/components/providers/auth-provider';
import {
  PartnerReportForm,
  toSavePayload,
} from '@/features/partner-reports/components/partner-report-form';
import { ReportDocumentView } from '@/features/partner-reports/components/report-document-view';
import { ReviewReportDialog } from '@/features/partner-reports/components/review-report-dialog';
import {
  downloadPartnerReportsCsv,
  useMyReportingStatus,
  usePartnerReport,
  useSubmitPartnerReport,
  useUpdatePartnerReport,
} from '@/features/partner-reports/hooks/use-partner-reports';
import {
  emptyReportValues,
  savePartnerReportSchema,
  type SavePartnerReportFormValues,
} from '@/features/partner-reports/schemas/report.schema';
import { BffClientError } from '@/lib/bff/client';

function departmentTitle(value?: string | null): string {
  const t = value?.trim();
  if (!t || /^none$/i.test(t)) return 'Report';
  return t;
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { can, user } = useAuthContext();
  const report = usePartnerReport(id);
  const update = useUpdatePartnerReport(id);
  const submit = useSubmitPartnerReport(id);
  const myStatus = useMyReportingStatus();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const form = useForm<SavePartnerReportFormValues>({
    resolver: zodResolver(savePartnerReportSchema),
    defaultValues: emptyReportValues,
  });

  useEffect(() => {
    const r = report.data;
    if (!r) return;
    form.reset({
      reportingOfficerName: r.reportingOfficerName,
      department: r.department,
      periodType: r.periodType,
      periodLabel: r.periodLabel ?? '',
      executiveSummary: r.executiveSummary ?? '',
      currency: r.currency ?? '',
      billingItems: r.billingItems?.length
        ? r.billingItems.map((b) => ({
            description: b.description,
            amount: b.amount,
            amountReceived: b.amountReceived ?? '0',
          }))
        : [],
      remark: r.remark ?? '',
      peopleCapacity: r.peopleCapacity ?? '',
      outlook: r.outlook ?? '',
      engagementUpdates: r.engagementUpdates ?? [],
      decisions: r.decisions ?? [],
    });
  }, [report.data, form]);

  if (report.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (report.isError || !report.data) {
    return (
      <div className="space-y-4">
        <PageToolbar
          title="Report not found"
          breadcrumbs={[
            { label: 'Home', href: '/dashboard' },
            { label: 'Reports', href: '/reports' },
          ]}
        />
        <p className="text-sm text-muted-foreground">This report could not be loaded.</p>
        <Button type="button" variant="outline" onClick={() => router.push('/reports')}>
          Back to list
        </Button>
      </div>
    );
  }

  const r = report.data;
  const isDraft = r.status === 'Draft';
  const isOwner = r.submittedById === user?.id;
  const canEdit = isDraft && isOwner && can('partner-report:submit');
  const canComment =
    (r.status === 'Submitted' || r.status === 'Reviewed') && can('partner-report:review');
  const alreadyReviewed = r.status === 'Reviewed';
  const canExport = can('partner-report:view-all') || isOwner;
  const showDocument = !canEdit;
  const reviewLabel = alreadyReviewed
    ? r.reviewNotes?.trim()
      ? 'Update notes'
      : 'Add notes'
    : 'Review';

  async function exportOne() {
    setExporting(true);
    try {
      await downloadPartnerReportsCsv(
        `partner-reports/${id}/export`,
        `report-${r.reportingOfficerName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
      );
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  async function saveDraft() {
    const parsed = savePartnerReportSchema.safeParse(form.getValues());
    if (!parsed.success) {
      await form.trigger();
      toast.error('Please complete the required fields');
      return;
    }
    try {
      await update.mutateAsync(toSavePayload(parsed.data));
      toast.success('Draft updated');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to save');
    }
  }

  async function submitReport() {
    const parsed = savePartnerReportSchema.safeParse(form.getValues());
    if (!parsed.success) {
      await form.trigger();
      toast.error('Please complete the required fields');
      return;
    }
    try {
      if (canEdit) await update.mutateAsync(toSavePayload(parsed.data));
      await submit.mutateAsync();
      toast.success('Report submitted to the Principal');
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to submit');
    }
  }

  return (
    <div className="min-w-0 space-y-5 pb-24 sm:pb-6">
      <PageToolbar
        title={departmentTitle(r.department)}
        description={[r.reportingOfficerName, r.periodLabel || formatStatusLabel(r.periodType)]
          .filter(Boolean)
          .join(' · ')}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Reports', href: '/reports' },
          { label: 'Report' },
        ]}
        actions={
          <StatusPill tone={resolveStatusTone(r.status)}>
            {formatStatusLabel(r.status)}
          </StatusPill>
        }
      />

      {showDocument ? (
        <ReportDocumentView report={r} />
      ) : (
        <PartnerReportForm
          form={form}
          financialsEnabled={myStatus.data?.financialsEnabled ?? true}
          onSaveDraft={saveDraft}
          onSubmitReport={submitReport}
          saving={update.isPending}
          submitting={submit.isPending || update.isPending}
        />
      )}

      {showDocument ? (
        <div className="sticky bottom-0 z-20 -mx-3 border-t border-border bg-background/95 px-3 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => router.push('/reports')}
            >
              Back
            </Button>
            {canExport && !isDraft ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-w-0 flex-1 sm:flex-none"
                disabled={exporting}
                onClick={() => void exportOne()}
              >
                <IconDownload className="size-4 shrink-0" />
                <span className="truncate">{exporting ? 'Exporting…' : 'Export PDF'}</span>
              </Button>
            ) : null}
            {canComment ? (
              <Button
                type="button"
                size="sm"
                className="min-w-0 flex-[1.2] sm:flex-none"
                onClick={() => setReviewOpen(true)}
              >
                <span className="truncate">{reviewLabel}</span>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canComment ? (
        <ReviewReportDialog
          reportId={r.id}
          officerName={r.reportingOfficerName}
          alreadyReviewed={alreadyReviewed}
          initialNotes={r.reviewNotes}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
        />
      ) : null}
    </div>
  );
}
