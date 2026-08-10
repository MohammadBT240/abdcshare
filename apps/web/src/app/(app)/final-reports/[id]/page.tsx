'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  IconCheck,
  IconDownload,
  IconEye,
  IconFileText,
  IconLock,
  IconMessageCircle,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { StatusPill, formatStatusLabel, resolveStatusTone } from '@/components/data';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { FileViewerDialog } from '@/components/files/file-viewer-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  fetchClientReportFilePreview,
  fetchClientReportZipEntries,
  fetchClientReportZipEntry,
  openClientReportFileDownload,
  type ReportFile,
  type ReportReviewCycle,
  type ReportReviewState,
  useClientFinalReport,
  useDownloadClientFinalReport,
  useRespondToFinalReport,
} from '@/features/report-reviews/hooks/use-report-reviews';
import { BffClientError } from '@/lib/bff/client';

function clientReviewLabel(state: ReportReviewState): string {
  switch (state) {
    case 'AwaitingClient':
      return 'Awaiting your response';
    case 'ChangesRequested':
      return 'Changes requested';
    case 'Approved':
      return 'Approved';
    case 'Locked':
      return 'Locked';
    case 'Overridden':
      return 'Issued';
    default:
      return formatStatusLabel(state);
  }
}

function statusMessage(state: ReportReviewState): string {
  switch (state) {
    case 'AwaitingClient':
      return 'Please review the current file and approve it, or request changes with feedback.';
    case 'ChangesRequested':
      return 'Your feedback was sent to the firm. A revised draft will appear here when ready.';
    case 'Approved':
      return 'You approved this report. No further action is needed.';
    case 'Overridden':
      return 'The firm has issued this report as final.';
    case 'Locked':
      return 'Review rounds are complete. The firm will decide how to proceed.';
    default:
      return 'Review status for this final report.';
  }
}

function formatWhen(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function friendlyType(mimeType?: string | null, fileName?: string): string {
  const name = fileName?.toLowerCase() ?? '';
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
  if (
    mimeType?.includes('wordprocessingml') ||
    name.endsWith('.docx') ||
    name.endsWith('.doc')
  ) {
    return 'Word';
  }
  if (
    mimeType?.includes('spreadsheetml') ||
    name.endsWith('.xlsx') ||
    name.endsWith('.xls')
  ) {
    return 'Excel';
  }
  if (mimeType === 'application/zip' || name.endsWith('.zip')) return 'ZIP archive';
  return 'File';
}

function isZip(mimeType?: string | null, fileName?: string): boolean {
  if (mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed') return true;
  return Boolean(fileName?.toLowerCase().endsWith('.zip'));
}

export default function FinalReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const report = useClientFinalReport(id);
  const download = useDownloadClientFinalReport();
  const [response, setResponse] = useState<'Approved' | 'ChangesRequested' | null>(null);
  const [viewerFile, setViewerFile] = useState<ReportFile | null>(null);

  if (report.isPending) {
    return (
      <div className="space-y-5">
        <div className="h-10 w-2/3 max-w-md animate-pulse rounded-md bg-muted" />
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
        <div className="h-48 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (report.isError || !report.data) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm font-medium text-destructive">Couldn’t load this final report</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" asChild>
          <Link href="/final-reports">Back to final reports</Link>
        </Button>
      </div>
    );
  }

  const detail = report.data;
  const canRespond = detail.reviewState === 'AwaitingClient';
  const currentFile = detail.currentFile ?? null;
  const currentCycle = detail.cycles.find((c) => c.roundNo === detail.reviewRound);
  const roundsLeft = Math.max(0, detail.maxRounds - detail.reviewRound);
  const history = [...detail.cycles].sort((a, b) => b.roundNo - a.roundNo);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageToolbar
        title={detail.title}
        description={`${detail.engagementReferenceCode} · ${detail.engagementTitle}`}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Final reports', href: '/final-reports' },
          { label: detail.title },
        ]}
        actions={
          currentFile ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={download.isPending}
              onClick={() =>
                download.mutate(id, {
                  onError: (error) =>
                    toast.error(
                      error instanceof Error ? error.message : 'Failed to download report',
                    ),
                })
              }
            >
              <IconDownload className="mr-2 h-4 w-4" />
              Download
            </Button>
          ) : null
        }
      />

      {/* Status hero */}
      <section
        className={cn(
          'rounded-lg border border-border bg-card p-5 shadow-aca',
          canRespond && 'ring-1 ring-primary/20',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <StatusPill tone={resolveStatusTone(detail.reviewState)}>
              {clientReviewLabel(detail.reviewState)}
            </StatusPill>
            <p className="max-w-xl text-sm text-muted-foreground">
              {statusMessage(detail.reviewState)}
            </p>
            <p className="text-xs text-muted-foreground">
              Engagement{' '}
              <Link
                href={`/engagements/${detail.engagementId}`}
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                {detail.engagementReferenceCode}
              </Link>
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Cycle
            </p>
            <p className="text-sm font-semibold tabular-nums">
              {detail.reviewRound} / {detail.maxRounds}
            </p>
          </div>
        </div>

        <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
          <Meta
            label="Sent"
            value={formatWhen(currentCycle?.sentAt)}
          />
          <Meta
            label="Version"
            value={currentFile ? `v${currentFile.version}` : `v${detail.currentVersion}`}
          />
          <Meta
            label={canRespond ? 'Rounds left' : 'Outcome'}
            value={
              canRespond
                ? roundsLeft === 0
                  ? 'Last round'
                  : String(roundsLeft)
                : clientReviewLabel(detail.reviewState)
            }
          />
        </dl>

        {canRespond ? (
          <div className="mt-5 flex flex-col gap-2 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Open the file below before you decide, if you haven’t already.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setResponse('Approved')}>
                <IconCheck className="mr-1.5 h-4 w-4" />
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResponse('ChangesRequested')}
              >
                <IconMessageCircle className="mr-1.5 h-4 w-4" />
                Request changes
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      {/* Current file */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Current report file</h2>
          {currentFile ? (
            <span className="text-xs text-muted-foreground">
              {friendlyType(currentFile.mimeType, currentFile.fileName)}
            </span>
          ) : null}
        </div>
        {currentFile ? (
          <FileCard
            file={currentFile}
            onOpen={() => setViewerFile(currentFile)}
            onDownload={() =>
              void openClientReportFileDownload(detail.documentId, currentFile.id).catch(
                (error) =>
                  toast.error(
                    error instanceof Error ? error.message : 'Failed to download file',
                  ),
              )
            }
            emphasize
          />
        ) : (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-4">
            <IconFileText className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No file is attached to this review round yet.
            </p>
          </div>
        )}
      </section>

      {/* History */}
      {history.length ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Review history</h2>
          <ol className="relative space-y-3 border-l border-border pl-4 sm:pl-5">
            {history.map((cycle, index) => (
              <HistoryItem
                key={cycle.id}
                cycle={cycle}
                isLatest={index === 0}
                onOpenFile={(file) => setViewerFile(file)}
                onDownloadFile={(file) =>
                  void openClientReportFileDownload(detail.documentId, file.id).catch((error) =>
                    toast.error(
                      error instanceof Error ? error.message : 'Failed to download file',
                    ),
                  )
                }
              />
            ))}
          </ol>
        </section>
      ) : null}

      {viewerFile ? (
        <FileViewerDialog
          open
          onOpenChange={(open) => {
            if (!open) setViewerFile(null);
          }}
          fileName={viewerFile.fileName}
          mimeType={viewerFile.mimeType}
          sizeBytes={viewerFile.sizeBytes}
          getPreview={(opts) =>
            fetchClientReportFilePreview(detail.documentId, viewerFile.id, opts)
          }
          getZipEntries={
            isZip(viewerFile.mimeType, viewerFile.fileName)
              ? () => fetchClientReportZipEntries(detail.documentId, viewerFile.id)
              : undefined
          }
          getZipEntry={
            isZip(viewerFile.mimeType, viewerFile.fileName)
              ? (entryPath) =>
                  fetchClientReportZipEntry(detail.documentId, viewerFile.id, entryPath)
              : undefined
          }
          onDownload={() => openClientReportFileDownload(detail.documentId, viewerFile.id)}
        />
      ) : null}

      {response ? (
        <ResponseDialog id={id} decision={response} onClose={() => setResponse(null)} />
      ) : null}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function FileCard({
  file,
  onOpen,
  onDownload,
  emphasize,
}: {
  file: ReportFile;
  onOpen: () => void;
  onDownload: () => void;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center',
        emphasize && 'shadow-aca',
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <FileTypeIcon fileName={file.fileName} mimeType={file.mimeType} size={32} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={file.fileName}>
            {file.fileName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Version {file.version}
            {' · '}
            {formatBytes(file.sizeBytes)}
            {' · '}
            {friendlyType(file.mimeType, file.fileName)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onOpen}>
          <IconEye className="mr-1.5 h-4 w-4" />
          Open
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDownload}>
          <IconDownload className="mr-1.5 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

function HistoryItem({
  cycle,
  isLatest,
  onOpenFile,
  onDownloadFile,
}: {
  cycle: ReportReviewCycle;
  isLatest: boolean;
  onOpenFile: (file: ReportFile) => void;
  onDownloadFile: (file: ReportFile) => void;
}) {
  const pending = cycle.decision === 'Pending';
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[1.35rem] top-3 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card sm:-left-[1.6rem]',
          isLatest && 'border-primary/40',
        )}
      >
        {cycle.decision === 'Approved' ? (
          <IconCheck className="h-3 w-3 text-emerald-600" />
        ) : cycle.decision === 'ChangesRequested' ? (
          <IconMessageCircle className="h-3 w-3 text-amber-600" />
        ) : pending ? (
          <IconLock className="h-3 w-3 text-muted-foreground" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
        )}
      </span>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              Round {cycle.roundNo}
              <span className="font-normal text-muted-foreground">
                {' '}
                · v{cycle.fileVersion}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sent {formatWhen(cycle.sentAt)}
              {cycle.decidedAt ? ` · Decided ${formatWhen(cycle.decidedAt)}` : ''}
            </p>
          </div>
          <StatusPill tone={resolveStatusTone(cycle.decision)}>
            {pending ? 'Awaiting your response' : formatStatusLabel(cycle.decision)}
          </StatusPill>
        </div>

        {cycle.feedback ? (
          <blockquote className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {cycle.feedback}
          </blockquote>
        ) : null}

        {cycle.file ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <FileTypeIcon
              fileName={cycle.file.fileName}
              mimeType={cycle.file.mimeType}
              size={18}
            />
            <span className="min-w-0 flex-1 truncate text-xs" title={cycle.file.fileName}>
              {cycle.file.fileName}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onOpenFile(cycle.file!)}
            >
              <IconEye className="mr-1 h-3.5 w-3.5" />
              Open
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => onDownloadFile(cycle.file!)}
            >
              <IconDownload className="mr-1 h-3.5 w-3.5" />
              Download
            </Button>
          </div>
        ) : null}
      </div>
    </li>
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
          ? 'Approval finalises this report for your organisation.'
          : 'Describe what the firm should change. They will send a revised draft.'
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <LoadingButton loading={respond.isPending} onClick={submit}>
          {decision === 'Approved' ? 'Confirm approval' : 'Send feedback'}
        </LoadingButton>
      }
    >
      <FormField
        label={decision === 'Approved' ? 'Note (optional)' : 'Feedback'}
        required={decision === 'ChangesRequested'}
      >
        <Textarea
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          rows={5}
          placeholder={
            decision === 'Approved'
              ? 'Optional comment for the firm…'
              : 'What needs to change?'
          }
        />
      </FormField>
    </FormDialog>
  );
}
