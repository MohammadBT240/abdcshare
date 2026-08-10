'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useReviewPartnerReport } from '@/features/partner-reports/hooks/use-partner-reports';

interface ReviewReportDialogProps {
  reportId: string;
  officerName: string;
  /** When true, report is already Reviewed — dialog only updates notes. */
  alreadyReviewed?: boolean;
  initialNotes?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReviewReportDialog({
  reportId,
  officerName,
  alreadyReviewed = false,
  initialNotes,
  open,
  onOpenChange,
}: ReviewReportDialogProps) {
  const review = useReviewPartnerReport(reportId);
  const [notes, setNotes] = useState(initialNotes?.trim() ?? '');

  useEffect(() => {
    if (open) setNotes(initialNotes?.trim() ?? '');
  }, [open, initialNotes]);

  async function submit() {
    try {
      await review.mutateAsync({ notes: notes.trim() || undefined });
      toast.success(
        alreadyReviewed ? 'Principal notes updated' : 'Report marked as reviewed',
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof BffClientError
          ? error.message
          : alreadyReviewed
            ? 'Failed to update notes'
            : 'Failed to review report',
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={alreadyReviewed ? 'Principal notes' : 'Review report'}
      description={
        alreadyReviewed
          ? `Update your notes on the report from ${officerName}.`
          : `Mark the report from ${officerName} as reviewed.`
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="button" loading={review.isPending} onClick={submit}>
            {alreadyReviewed ? 'Save notes' : 'Mark reviewed'}
          </LoadingButton>
        </>
      }
    >
      <FormField label="Notes (optional)">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Feedback for the reporting officer"
        />
      </FormField>
    </FormDialog>
  );
}
