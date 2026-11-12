'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { BffClientError } from '@/lib/bff/client';
import { useReportLibraryItem } from '@/features/library/hooks/use-library';
import { REPORT_REASONS } from '@/features/library/lib/licence';
import type { LibraryItem, LibraryReportReason } from '@/features/library/types';

const FORM_ID = 'report-library-item-form';

/** "Report a problem" (S2, D19). The item stays visible until a curator acts. */
export function ReportLibraryItemDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LibraryItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const report = useReportLibraryItem();
  const [reason, setReason] = useState<LibraryReportReason | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote('');
    setError(null);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return setError('Choose what the problem is');
    if (reason === 'Other' && !note.trim()) return setError('Tell the curators what the problem is');
    setError(null);
    try {
      await report.mutateAsync({ id: item.id, reason, note: note.trim() || null });
      toast.success('Thanks — a library curator will look at it', {
        description: 'You will get a notification when they have.',
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof BffClientError ? err.message : 'The report could not be sent');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => !report.isPending && onOpenChange(next)}
      title="Report a problem"
      description={`Tell the library curators what's wrong with “${item.title}”. It stays visible until they act.`}
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={report.isPending}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={FORM_ID} loading={report.isPending}>
            Send report
          </LoadingButton>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="What is the problem?" className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={reason === r.value}
              onClick={() => setReason(r.value)}
              disabled={report.isPending}
              className={cn(
                'flex w-full flex-col rounded-lg border px-3 py-2 text-left transition-colors',
                reason === r.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50',
              )}
            >
              <span className="text-sm font-medium text-foreground">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.hint}</span>
            </button>
          ))}
        </div>
        <FormField label="Note" htmlFor="report-note" hint={reason === 'Other' ? 'Required.' : 'Optional.'}>
          <Textarea
            id="report-note"
            rows={3}
            maxLength={2000}
            value={note}
            disabled={report.isPending}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Page 4 names the client"
          />
        </FormField>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
