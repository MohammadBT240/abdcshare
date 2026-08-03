'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDownload,
  IconMessageReply,
  IconRotateClockwise,
  IconUpload,
} from '@tabler/icons-react';
import { SubmissionStatus } from '@abdcshare/shared';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { FileViewerDialog } from '@/components/files/file-viewer-dialog';
import { BffClientError } from '@/lib/bff/client';
import {
  type Submission,
  type SubmissionFile,
  fetchSubmissionFilePreview,
  fetchSubmissionZipEntries,
  fetchSubmissionZipEntry,
  openSubmissionFileDownload,
  requestSubmissionExport,
  useReopenSubmissionFile,
  useReplaceSubmissionFile,
  useReviewSubmissionFile,
  useSubmissions,
} from '@/features/submissions/hooks/use-submissions';
import { useReviewsList } from '@/features/reviews/hooks/use-reviews';
import {
  countsFromSubmissions,
  SubmissionMetricCards,
} from '@/features/submissions/components/submission-metric-cards';
import { RespondDialog } from '@/features/submissions/components/respond-dialog';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const PAGE_SIZE = 5;

interface RequestSubmissionsPanelProps {
  requestId: string;
  canRespond: boolean;
  canReview: boolean;
  enabled?: boolean;
  hideMetrics?: boolean;
  className?: string;
}

function statusVariant(status: SubmissionStatus): BadgeProps['variant'] {
  if (status === SubmissionStatus.Accepted) return 'success';
  if (status === SubmissionStatus.Returned) return 'destructive';
  return 'secondary';
}

function formatBytes(bytes?: number | null): string | null {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof BffClientError ? error.message : fallback;
}

function isZipFile(file: SubmissionFile): boolean {
  return (
    file.mimeType === 'application/zip' ||
    file.mimeType === 'application/x-zip-compressed' ||
    file.fileName.toLowerCase().endsWith('.zip')
  );
}

/** Prefer a readable filename tail when UUID-prefixed. */
function displayFileName(fileName: string, max = 42): string {
  if (fileName.length <= max) return fileName;
  const extIdx = fileName.lastIndexOf('.');
  const ext = extIdx > 0 ? fileName.slice(extIdx) : '';
  const base = extIdx > 0 ? fileName.slice(0, extIdx) : fileName;
  const keep = Math.max(12, max - ext.length - 1);
  return `${base.slice(-keep)}${ext}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function fileChipSummary(files: SubmissionFile[]): string {
  const current = files.filter((f) => !f.superseded);
  if (current.length === 0) return 'No files';
  const pending = current.filter((f) => f.status === SubmissionStatus.Pending).length;
  const accepted = current.filter((f) => f.status === SubmissionStatus.Accepted).length;
  const returned = current.filter((f) => f.status === SubmissionStatus.Returned).length;
  const parts: string[] = [`${current.length} file${current.length === 1 ? '' : 's'}`];
  if (pending) parts.push(`${pending} pending`);
  if (returned) parts.push(`${returned} returned`);
  if (accepted && (pending || returned)) parts.push(`${accepted} accepted`);
  return parts.join(' · ');
}

function IconAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          disabled={disabled}
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function ReopenFileDialog({
  open,
  onOpenChange,
  fileName,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  busy: boolean;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title="Reopen for revision"
      description={`Ask the client to revise “${displayFileName(fileName, 60)}”. Acceptance will be withdrawn.`}
      maxWidthClass="sm:max-w-md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <LoadingButton
            type="button"
            loading={busy}
            disabled={!reason.trim()}
            onClick={() => void onConfirm(reason.trim())}
          >
            Reopen
          </LoadingButton>
        </>
      }
    >
      <FormField label="Reason" required>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain what needs to change…"
          rows={3}
          disabled={busy}
        />
      </FormField>
    </FormDialog>
  );
}

function SubmissionFileRow({
  file,
  showFileStatus,
  canReplace,
  canReviewPending,
  canReopen,
  returning,
  returnReason,
  onReturnReasonChange,
  onAccept,
  onStartReturn,
  onCancelReturn,
  onConfirmReturn,
  onOpenViewer,
  onDownload,
  onReopen,
  onReplace,
  replacing,
  downloading,
  reviewing,
}: {
  file: SubmissionFile;
  showFileStatus: boolean;
  canReplace: boolean;
  canReviewPending: boolean;
  canReopen: boolean;
  returning: boolean;
  returnReason: string;
  onReturnReasonChange: (reason: string) => void;
  onAccept: () => void;
  onStartReturn: () => void;
  onCancelReturn: () => void;
  onConfirmReturn: () => void;
  onOpenViewer: () => void;
  onDownload: () => void;
  onReopen: () => void;
  onReplace: (file: SubmissionFile, browserFile: File) => void;
  replacing: boolean;
  downloading: boolean;
  reviewing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = !file.superseded && file.status === SubmissionStatus.Pending;
  const showBadge =
    showFileStatus &&
    (file.superseded ||
      file.status === SubmissionStatus.Accepted ||
      file.status === SubmissionStatus.Returned);

  return (
    <li
      className={cn(
        'group flex flex-col gap-1.5 py-2',
        file.superseded && 'opacity-50',
      )}
    >
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <FileTypeIcon fileName={file.fileName} mimeType={file.mimeType} size={16} />
        <button
          type="button"
          title={file.fileName}
          className={cn(
            'min-w-0 flex-1 truncate text-left font-medium text-foreground underline-offset-2 hover:underline',
            file.superseded && 'line-through',
          )}
          onClick={onOpenViewer}
          disabled={file.superseded}
        >
          {displayFileName(file.fileName)}
        </button>
        {formatBytes(file.sizeBytes) ? (
          <span className="shrink-0 tabular-nums text-muted-foreground">
            {formatBytes(file.sizeBytes)}
          </span>
        ) : null}
        {showBadge ? (
          <Badge variant={statusVariant(file.status)} className="h-5 shrink-0 px-1.5 text-[10px]">
            {file.superseded ? 'Replaced' : file.status}
          </Badge>
        ) : null}
        <div className="flex shrink-0 items-center">
          <IconAction label="Download" disabled={downloading} onClick={onDownload}>
            <IconDownload className="h-3.5 w-3.5" />
          </IconAction>
          {!file.superseded && canReopen && file.status === SubmissionStatus.Accepted ? (
            <IconAction label="Reopen for revision" onClick={onReopen}>
              <IconRotateClockwise className="h-3.5 w-3.5" />
            </IconAction>
          ) : null}
        </div>
      </div>

      {!file.superseded && file.status === SubmissionStatus.Returned && file.reviewReason ? (
        <p className="pl-6 text-[11px] text-destructive/90">{file.reviewReason}</p>
      ) : null}

      {canReviewPending && pending ? (
        <div className="space-y-1.5 pl-6">
          {!returning ? (
            <div className="flex flex-wrap gap-1.5">
              <LoadingButton
                type="button"
                size="sm"
                className="h-7"
                loading={reviewing}
                disabled={reviewing}
                onClick={onAccept}
              >
                <IconCheck className="mr-1 h-3.5 w-3.5" />
                Accept
              </LoadingButton>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7"
                disabled={reviewing}
                onClick={onStartReturn}
              >
                <IconRotateClockwise className="mr-1 h-3.5 w-3.5" />
                Return
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5 rounded-md border border-border bg-muted/20 p-2">
              <Textarea
                value={returnReason}
                onChange={(e) => onReturnReasonChange(e.target.value)}
                placeholder="Explain what to revise…"
                rows={2}
                className="text-xs"
                disabled={reviewing}
                autoFocus
              />
              <div className="flex flex-wrap justify-end gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  disabled={reviewing}
                  onClick={onCancelReturn}
                >
                  Cancel
                </Button>
                <LoadingButton
                  type="button"
                  size="sm"
                  className="h-7 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  loading={reviewing}
                  disabled={!returnReason.trim()}
                  onClick={onConfirmReturn}
                >
                  Confirm return
                </LoadingButton>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {!file.superseded && file.status === SubmissionStatus.Returned && canReplace ? (
        <div className="pl-6">
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onReplace(file, f);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7"
            disabled={replacing}
            onClick={() => inputRef.current?.click()}
          >
            <IconUpload className="mr-1 h-3.5 w-3.5" />
            Upload replacement
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function ReviewableSubmissionCard({
  requestId,
  submission,
  canReview,
  canReplace,
  isLatest,
  defaultExpanded,
  replacing,
  onReplace,
}: {
  requestId: string;
  submission: Submission;
  canReview: boolean;
  canReplace: boolean;
  isLatest: boolean;
  defaultExpanded: boolean;
  replacing: boolean;
  onReplace: (file: SubmissionFile, browserFile: File) => void;
}) {
  const reviewFile = useReviewSubmissionFile(requestId);
  const reopenFile = useReopenSubmissionFile(requestId);

  const currentFiles = useMemo(
    () => submission.files.filter((f) => !f.superseded),
    [submission.files],
  );
  const supersededFiles = useMemo(
    () => submission.files.filter((f) => f.superseded),
    [submission.files],
  );
  const pendingFiles = useMemo(
    () => currentFiles.filter((f) => f.status === SubmissionStatus.Pending),
    [currentFiles],
  );
  const canReviewPending = canReview && pendingFiles.length > 0;
  const mixedStatuses =
    new Set(currentFiles.map((f) => f.status)).size > 1 ||
    currentFiles.some((f) => f.status === SubmissionStatus.Returned);
  const showFileStatus = mixedStatuses || submission.status !== SubmissionStatus.Accepted;

  const [expanded, setExpanded] = useState(defaultExpanded);
  const [filesOpen, setFilesOpen] = useState(
    defaultExpanded || pendingFiles.length > 0 || canReplace,
  );
  const [showSuperseded, setShowSuperseded] = useState(false);
  const [returningId, setReturningId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [viewerFile, setViewerFile] = useState<SubmissionFile | null>(null);
  const [reopenTarget, setReopenTarget] = useState<SubmissionFile | null>(null);

  useEffect(() => {
    if (pendingFiles.length > 0) {
      setExpanded(true);
      setFilesOpen(true);
    }
  }, [pendingFiles.length]);

  async function handleAccept(file: SubmissionFile) {
    setReviewingId(file.id);
    try {
      await reviewFile.mutateAsync({
        submissionId: submission.id,
        fileId: file.id,
        decision: SubmissionStatus.Accepted,
      });
      toast.success(`Accepted ${displayFileName(file.fileName)}`);
      if (returningId === file.id) {
        setReturningId(null);
        setReturnReason('');
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to accept file'));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleConfirmReturn(file: SubmissionFile) {
    if (!returnReason.trim()) {
      toast.error('Add a reason for returning this file');
      return;
    }
    setReviewingId(file.id);
    try {
      await reviewFile.mutateAsync({
        submissionId: submission.id,
        fileId: file.id,
        decision: SubmissionStatus.Returned,
        reason: returnReason.trim(),
      });
      toast.success(`Returned ${displayFileName(file.fileName)}`);
      setReturningId(null);
      setReturnReason('');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to return file'));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDownload(file: SubmissionFile) {
    setDownloadingId(file.id);
    try {
      await openSubmissionFileDownload(submission.id, file.id);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to download file'));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadAll() {
    if (currentFiles.length === 0) return;
    setExportingAll(true);
    try {
      await requestSubmissionExport(submission.id);
      toast.success('Preparing archive… you’ll get a notification when it’s ready to download.');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to start download'));
    } finally {
      setExportingAll(false);
    }
  }

  async function handleReopen(reason: string) {
    if (!reopenTarget) return;
    try {
      await reopenFile.mutateAsync({
        submissionId: submission.id,
        fileId: reopenTarget.id,
        reason,
      });
      toast.success('File reopened for revision');
      setReopenTarget(null);
      setExpanded(true);
      setFilesOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to reopen file'));
    }
  }

  const messagePreview =
    submission.message.length > 120
      ? `${submission.message.slice(0, 120).trim()}…`
      : submission.message;

  return (
    <>
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {submission.submittedByName || 'Client response'}
            </p>
            <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
            {isLatest ? <Badge variant="outline">Latest</Badge> : null}
            {pendingFiles.length > 0 ? (
              <Badge variant="secondary" className="font-normal">
                {pendingFiles.length} to review
              </Badge>
            ) : null}
          </div>
          <p
            className="text-xs text-muted-foreground"
            title={new Date(submission.createdAt).toLocaleString()}
          >
            {relativeTime(submission.createdAt)}
            <span className="mx-1.5 text-border">·</span>
            {fileChipSummary(submission.files)}
          </p>
          {!expanded && submission.message.trim() ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">{messagePreview}</p>
          ) : null}
        </div>
        <IconChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded ? (
        <div className="mt-3 space-y-3">
          {submission.message.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {submission.message}
            </p>
          ) : null}

          {submission.files.length > 0 ? (
            <div className="rounded-md border border-border">
              <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md px-1 py-1 text-left text-xs font-medium text-muted-foreground hover:bg-muted/40"
                  onClick={() => setFilesOpen((v) => !v)}
                  aria-expanded={filesOpen}
                >
                  <span className="truncate">{fileChipSummary(submission.files)}</span>
                  <IconChevronDown
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-transform',
                      filesOpen && 'rotate-180',
                    )}
                  />
                </button>
                {currentFiles.length > 0 ? (
                  <LoadingButton
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2.5 text-xs"
                    loading={exportingAll}
                    onClick={() => void handleDownloadAll()}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                    Download all
                  </LoadingButton>
                ) : null}
              </div>

              {filesOpen ? (
                <div className="px-3">
                  <ul className="divide-y divide-border">
                    {currentFiles.map((file) => (
                      <SubmissionFileRow
                        key={file.id}
                        file={file}
                        showFileStatus={showFileStatus}
                        canReplace={canReplace}
                        canReviewPending={canReviewPending}
                        canReopen={canReview}
                        returning={returningId === file.id}
                        returnReason={returningId === file.id ? returnReason : ''}
                        onReturnReasonChange={setReturnReason}
                        onAccept={() => void handleAccept(file)}
                        onStartReturn={() => {
                          setReturningId(file.id);
                          setReturnReason('');
                        }}
                        onCancelReturn={() => {
                          setReturningId(null);
                          setReturnReason('');
                        }}
                        onConfirmReturn={() => void handleConfirmReturn(file)}
                        onOpenViewer={() => setViewerFile(file)}
                        onDownload={() => void handleDownload(file)}
                        onReopen={() => setReopenTarget(file)}
                        downloading={downloadingId === file.id}
                        reviewing={reviewingId === file.id}
                        replacing={replacing}
                        onReplace={onReplace}
                      />
                    ))}
                  </ul>

                  {supersededFiles.length > 0 ? (
                    <div className="border-t border-border py-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                        onClick={() => setShowSuperseded((v) => !v)}
                      >
                        {showSuperseded ? 'Hide' : 'Show'} previous versions (
                        {supersededFiles.length})
                      </button>
                      {showSuperseded ? (
                        <ul className="mt-1 divide-y divide-border">
                          {supersededFiles.map((file) => (
                            <SubmissionFileRow
                              key={file.id}
                              file={file}
                              showFileStatus
                              canReplace={false}
                              canReviewPending={false}
                              canReopen={false}
                              returning={false}
                              returnReason=""
                              onReturnReasonChange={() => undefined}
                              onAccept={() => undefined}
                              onStartReturn={() => undefined}
                              onCancelReturn={() => undefined}
                              onConfirmReturn={() => undefined}
                              onOpenViewer={() => setViewerFile(file)}
                              onDownload={() => void handleDownload(file)}
                              onReopen={() => undefined}
                              downloading={downloadingId === file.id}
                              reviewing={false}
                              replacing={false}
                              onReplace={() => undefined}
                            />
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
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
            fetchSubmissionFilePreview(submission.id, viewerFile.id, opts)
          }
          getZipEntries={
            isZipFile(viewerFile)
              ? () => fetchSubmissionZipEntries(submission.id, viewerFile.id)
              : undefined
          }
          getZipEntry={
            isZipFile(viewerFile)
              ? (entryPath) =>
                  fetchSubmissionZipEntry(submission.id, viewerFile.id, entryPath)
              : undefined
          }
          onDownload={() => openSubmissionFileDownload(submission.id, viewerFile.id)}
        />
      ) : null}

      <ReopenFileDialog
        open={Boolean(reopenTarget)}
        onOpenChange={(open) => {
          if (!open) setReopenTarget(null);
        }}
        fileName={reopenTarget?.fileName ?? ''}
        busy={reopenFile.isPending}
        onConfirm={handleReopen}
      />
    </>
  );
}

export function RequestSubmissionsPanel({
  requestId,
  canRespond,
  canReview,
  enabled = true,
  hideMetrics = false,
  className,
}: RequestSubmissionsPanelProps) {
  const [page, setPage] = useState(1);
  const submissions = useSubmissions(requestId, enabled, {
    page,
    pageSize: PAGE_SIZE,
  });
  const metricsSource = useSubmissions(requestId, enabled && !hideMetrics, {
    page: 1,
    pageSize: 100,
  });
  const reviews = useReviewsList(
    `requestId=${requestId}&status=ForReview&pageSize=1`,
    enabled && !hideMetrics,
  );
  const [respondOpen, setRespondOpen] = useState(false);
  const replaceFile = useReplaceSubmissionFile(requestId);
  const userId = useAuthStore((s) => s.user?.id);

  const items = submissions.data?.data ?? [];
  const meta = submissions.data?.meta;
  const latestNeedsReview =
    page === 1 &&
    items[0] &&
    (items[0].status === SubmissionStatus.Pending ||
      items[0].status === SubmissionStatus.Returned);
  const metricCounts = countsFromSubmissions(
    metricsSource.data?.data ?? [],
    reviews.data?.meta.total ?? 0,
  );

  async function handleReplace(submission: Submission, file: SubmissionFile, browserFile: File) {
    try {
      await replaceFile.mutateAsync({
        submissionId: submission.id,
        replacesFileId: file.id,
        file: browserFile,
      });
      toast.success('Replacement uploaded');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to upload replacement'));
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('space-y-3', className)}>
        {!hideMetrics ? <SubmissionMetricCards counts={metricCounts} /> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold">Client responses</h2>
              {latestNeedsReview ? (
                <Badge variant="secondary">
                  <IconClock className="mr-1 h-3 w-3" />
                  Latest awaiting review
                </Badge>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meta
                ? `${meta.total} response${meta.total === 1 ? '' : 's'}`
                : 'Responses for this request'}
            </p>
          </div>
          {canRespond ? (
            <Button type="button" size="sm" onClick={() => setRespondOpen(true)}>
              <IconMessageReply className="mr-2 h-4 w-4" />
              Send response
            </Button>
          ) : null}
        </div>

        {submissions.isPending ? (
          <p className="text-sm text-muted-foreground">Loading responses…</p>
        ) : submissions.isError ? (
          <p className="text-sm text-destructive">Failed to load responses.</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center">
            <p className="text-sm font-medium">No responses yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canRespond
                ? 'Send a response when the requested information is ready.'
                : 'Client responses will appear here for review.'}
            </p>
          </div>
        ) : (
          <>
            <ul className="overflow-hidden rounded-lg border border-border bg-card">
              {items.map((submission, index) => {
                const canReplace =
                  canRespond && userId != null && submission.submittedById === userId;
                const isLatest = page === 1 && index === 0;
                const needsAttention =
                  isLatest ||
                  submission.files.some(
                    (f) =>
                      !f.superseded &&
                      (f.status === SubmissionStatus.Pending ||
                        (f.status === SubmissionStatus.Returned && canReplace)),
                  );
                return (
                  <li
                    key={submission.id}
                    className={cn('px-4 py-3.5', index > 0 && 'border-t border-border')}
                  >
                    <ReviewableSubmissionCard
                      requestId={requestId}
                      submission={submission}
                      canReview={canReview}
                      canReplace={canReplace}
                      isLatest={isLatest}
                      defaultExpanded={needsAttention}
                      replacing={replaceFile.isPending}
                      onReplace={(f, browserFile) =>
                        void handleReplace(submission, f, browserFile)
                      }
                    />
                  </li>
                );
              })}
            </ul>

            {meta && meta.totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>
                  Page {meta.page} of {meta.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasPrev || submissions.isFetching}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!meta.hasNext || submissions.isFetching}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {canRespond ? (
          <RespondDialog requestId={requestId} open={respondOpen} onOpenChange={setRespondOpen} />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

export function RequestSubmissionsTab(props: RequestSubmissionsPanelProps) {
  return <RequestSubmissionsPanel {...props} />;
}
