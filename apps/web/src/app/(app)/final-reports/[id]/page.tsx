'use client';

import { use, useState } from 'react';
import { IconDownload } from '@tabler/icons-react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  useClientFinalReport,
  useDownloadClientFinalReport,
  useRespondToFinalReport,
} from '@/features/report-reviews/hooks/use-report-reviews';
import { BffClientError } from '@/lib/bff/client';

export default function FinalReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const report = useClientFinalReport(id);
  const download = useDownloadClientFinalReport();
  const [response, setResponse] = useState<'Approved' | 'ChangesRequested' | null>(null);

  if (report.isPending) return <p className="text-sm text-muted-foreground">Loading final report…</p>;
  if (report.isError || !report.data) {
    return <p className="text-sm text-destructive">Failed to load final report</p>;
  }

  const detail = report.data;
  const canRespond = detail.reviewState === 'AwaitingClient';

  return (
    <div className="space-y-5">
      <PageToolbar
        title={detail.title}
        description={`Version ${detail.currentVersion} · Review round ${detail.reviewRound} of ${detail.maxRounds}`}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Final reports', href: '/final-reports' },
          { label: detail.title },
        ]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={download.isPending}
            onClick={() =>
              download.mutate(id, {
                onError: (error) =>
                  toast.error(error instanceof Error ? error.message : 'Failed to download report'),
              })
            }
          >
            <IconDownload className="mr-2 h-4 w-4" />
            Download
          </Button>
        }
      />

      <section className="rounded-lg border border-border bg-card p-5 shadow-aca">
        <div className="grid gap-4 sm:grid-cols-3">
          <Info label="Status" value={<Badge variant="outline">{formatState(detail.reviewState)}</Badge>} />
          <Info label="Current cycle" value={`Round ${detail.reviewRound} of ${detail.maxRounds}`} />
          <Info label="File version" value={`v${detail.currentVersion}`} />
        </div>
        {canRespond ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-5">
            <Button type="button" onClick={() => setResponse('Approved')}>Approve</Button>
            <Button type="button" variant="outline" onClick={() => setResponse('ChangesRequested')}>
              Request changes
            </Button>
          </div>
        ) : null}
      </section>

      {detail.cycles.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Review history</h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {detail.cycles.map((cycle) => (
              <li key={cycle.id} className="space-y-1 p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Round {cycle.roundNo} · v{cycle.fileVersion}</span>
                  <Badge variant="outline">{formatState(cycle.decision)}</Badge>
                </div>
                {cycle.feedback ? <p className="text-muted-foreground">{cycle.feedback}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {response ? (
        <ResponseDialog id={id} decision={response} onClose={() => setResponse(null)} />
      ) : null}
    </div>
  );
}

function ResponseDialog({
  id,
  decision,
  onClose,
}: {
  id: string;
  decision: 'Approved' | 'ChangesRequested';
  onClose: () => void;
}) {
  const respond = useRespondToFinalReport(id);
  const [feedback, setFeedback] = useState('');

  async function submit() {
    if (decision === 'ChangesRequested' && !feedback.trim()) {
      toast.error('Feedback is required when requesting changes');
      return;
    }
    try {
      await respond.mutateAsync({ decision, feedback: feedback.trim() || undefined });
      toast.success(decision === 'Approved' ? 'Final report approved' : 'Changes requested');
      onClose();
    } catch (error) {
      toast.error(error instanceof BffClientError ? error.message : 'Failed to send response');
    }
  }

  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={decision === 'Approved' ? 'Approve final report?' : 'Request changes'}
      description={
        decision === 'Approved'
          ? 'Approval finalises this report.'
          : 'Describe the changes the firm should make.'
      }
      maxWidthClass="sm:max-w-lg"
      footer={<LoadingButton loading={respond.isPending} onClick={submit}>Confirm</LoadingButton>}
    >
      <FormField label="Feedback" required={decision === 'ChangesRequested'}>
        <Textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={5} />
      </FormField>
    </FormDialog>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function formatState(value: string) {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}
