'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconClock,
  IconDownload,
  IconMessage,
  IconMessageReply,
  IconArrowBackUp,
  IconRotateClockwise,
  IconUpload,
} from '@tabler/icons-react';
import { SubmissionStatus } from '@abdcshare/shared';
import { toast } from 'sonner';
import { FormDialog, FormField, LoadingButton, UPLOAD_MAX_BYTES } from '@/components/forms';
import { StatusPill, formatStatusLabel, resolveStatusTone } from '@/components/data';
import { Badge } from '@/components/ui/badge';
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
  useDiscardDraft,
  useReopenSubmissionFile,
  useReplaceSubmissionFile,
  useReviewSubmissionFile,
  useStartSubmissionFileReview,
  useSubmissions,
  useUndoAcceptSubmissionFile,
  useUndoReturnSubmissionFile,
} from '@/features/submissions/hooks/use-submissions';
import { watchSubmissionExportToast } from '@/features/submissions/lib/export-toast';
import {
  countsFromSubmissions,
  SubmissionMetricCards,
} from '@/features/submissions/components/submission-metric-cards';
import { RespondDialog } from '@/features/submissions/components/respond-dialog';
import {
  clearDraftUploadSession,
  isSessionActive,
  loadDraftUploadSession,
} from '@/features/submissions/lib/draft-upload-session';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { MULTIPART_THRESHOLD_BYTES } from '@/lib/uploads/uppy-client';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const PAGE_SIZE = 5;

type ReplaceProgress = {
  fileId: string;
  fileName: string;
  percent: number;
  sizeBytes: number;
};

interface RequestSubmissionsPanelProps {
  requestId: string;
  canRespond: boolean;
  canReview: boolean;
  enabled?: boolean;
  hideMetrics?: boolean;
  className?: string;
  /** Jump to discussion with this file tagged. */
  onDiscussFile?: (file: {
    id: string;
    fileName: string;
    status: SubmissionStatus;
    submissionId: string;
  }) => void;
}

function submissionStatusTone(status: SubmissionStatus) {
  return resolveStatusTone(status);
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

function fileChipSummary(files: SubmissionFile[], submissionStatus?: SubmissionStatus): string {
  const current = files.filter((f) => !f.superseded);
  if (submissionStatus === SubmissionStatus.Draft) {
    if (current.length === 0) return 'No files yet · not sent';
    return `${current.length} file${current.length === 1 ? '' : 's'} · sending…`;
  }
  if (current.length === 0) return 'No files';
  const pending = current.filter((f) => f.status === SubmissionStatus.Pending).length;
  const underReview = current.filter(
    (f) => f.status === SubmissionStatus.UnderReview,
  ).length;
  const accepted = current.filter((f) => f.status === SubmissionStatus.Accepted).length;
  const returned = current.filter((f) => f.status === SubmissionStatus.Returned).length;
  const parts: string[] = [`${current.length} file${current.length === 1 ? '' : 's'}`];
  if (pending) parts.push(`${pending} awaiting review`);
  if (underReview) parts.push(`${underReview} under review`);
  if (returned) parts.push(`${returned} returned`);
  if (accepted && (pending || underReview || returned)) parts.push(`${accepted} accepted`);
  return parts.join(' · ');
}

function canClientAttachMore(status: SubmissionStatus): boolean {
  return (
    status === SubmissionStatus.Draft ||
    status === SubmissionStatus.Pending ||
    status === SubmissionStatus.UnderReview ||
    status === SubmissionStatus.Returned
  );
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

function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  placeholder,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  placeholder: string;
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
      title={title}
      description={description}
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
            {confirmLabel}
          </LoadingButton>
        </>
      }
    >
      <FormField label="Reason" required>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
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
  onUndoAccept,
  onUndoReturn,
  onReplace,
  onDiscuss,
  replaceProgress,
  replaceBusy,
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
  onUndoAccept: () => void;
  onUndoReturn: () => void;
  onReplace: (file: SubmissionFile, browserFile: File) => void;
  onDiscuss?: () => void;
  /** Progress for this row’s in-flight replacement, if any. */
  replaceProgress: ReplaceProgress | null;
  /** True while any replacement upload is running (disables other replace buttons). */
  replaceBusy: boolean;
  downloading: boolean;
  reviewing: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadingThis = replaceProgress?.fileId === file.id;
  const reviewable =
    !file.superseded &&
    (file.status === SubmissionStatus.Pending ||
      file.status === SubmissionStatus.UnderReview);
  const showBadge =
    showFileStatus &&
    (file.superseded ||
      file.status === SubmissionStatus.Pending ||
      file.status === SubmissionStatus.Accepted ||
      file.status === SubmissionStatus.Returned ||
      file.status === SubmissionStatus.UnderReview);

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
        {file.uploadedAt ? (
          <span
            className="hidden shrink-0 text-muted-foreground sm:inline"
            title={new Date(file.uploadedAt).toLocaleString()}
          >
            {relativeTime(file.uploadedAt)}
          </span>
        ) : null}
        {showBadge ? (
          <StatusPill
            tone={file.superseded ? 'neutral' : submissionStatusTone(file.status)}
            className="h-5 shrink-0 px-2 text-[10px]"
          >
            {file.superseded
              ? 'Replaced'
              : formatStatusLabel(file.status)}
          </StatusPill>
        ) : null}
        <div className="flex shrink-0 items-center">
          {onDiscuss && !file.superseded ? (
            <IconAction label="Discuss this file" onClick={onDiscuss}>
              <IconMessage className="h-3.5 w-3.5" />
            </IconAction>
          ) : null}
          <IconAction label="Download" disabled={downloading} onClick={onDownload}>
            <IconDownload className="h-3.5 w-3.5" />
          </IconAction>
          {!file.superseded && canReopen && file.status === SubmissionStatus.Accepted ? (
            <>
              <IconAction label="Undo accept" onClick={onUndoAccept}>
                <IconArrowBackUp className="h-3.5 w-3.5" />
              </IconAction>
              <IconAction label="Reopen for review" onClick={onReopen}>
                <IconRotateClockwise className="h-3.5 w-3.5" />
              </IconAction>
            </>
          ) : null}
          {!file.superseded && canReopen && file.status === SubmissionStatus.Returned ? (
            <IconAction label="Undo return" onClick={onUndoReturn}>
              <IconArrowBackUp className="h-3.5 w-3.5" />
            </IconAction>
          ) : null}
        </div>
      </div>

      {!file.superseded && file.status === SubmissionStatus.Returned && file.reviewReason ? (
        <p className="pl-6 text-[11px] text-destructive/90">{file.reviewReason}</p>
      ) : null}
      {!file.superseded &&
      file.status === SubmissionStatus.UnderReview &&
      file.reviewReason ? (
        <p className="pl-6 text-[11px] text-violet-800/90 dark:text-violet-200/90">
          {file.reviewReason}
        </p>
      ) : null}

      {canReviewPending && reviewable ? (
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
        <div className="space-y-2 pl-6">
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
          {uploadingThis && replaceProgress ? (
            <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">
                  Uploading {replaceProgress.fileName}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {replaceProgress.percent}%
                  {replaceProgress.sizeBytes > MULTIPART_THRESHOLD_BYTES
                    ? ' · multipart'
                    : ''}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-[width] duration-150"
                  style={{ width: `${replaceProgress.percent}%` }}
                />
              </div>
              {formatBytes(replaceProgress.sizeBytes) ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatBytes(replaceProgress.sizeBytes)}
                  {replaceProgress.sizeBytes > MULTIPART_THRESHOLD_BYTES
                    ? ' — large file, uploading in chunks'
                    : null}
                </p>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7"
              disabled={replaceBusy}
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload className="mr-1 h-3.5 w-3.5" />
              Upload replacement
            </Button>
          )}
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
  replaceProgress,
  replaceBusy,
  onReplace,
  onContinueDraft,
  onDiscardDraft,
  onAddFiles,
  onDiscussFile,
}: {
  requestId: string;
  submission: Submission;
  canReview: boolean;
  canReplace: boolean;
  isLatest: boolean;
  defaultExpanded: boolean;
  replaceProgress: ReplaceProgress | null;
  replaceBusy: boolean;
  onReplace: (file: SubmissionFile, browserFile: File) => void;
  onContinueDraft?: () => void;
  onDiscardDraft?: () => void;
  onAddFiles?: () => void;
  onDiscussFile?: (file: SubmissionFile) => void;
}) {
  const reviewFile = useReviewSubmissionFile(requestId);
  const reopenFile = useReopenSubmissionFile(requestId);
  const startReview = useStartSubmissionFileReview(requestId);
  const undoAccept = useUndoAcceptSubmissionFile(requestId);
  const undoReturn = useUndoReturnSubmissionFile(requestId);

  const currentFiles = useMemo(
    () => submission.files.filter((f) => !f.superseded),
    [submission.files],
  );
  const supersededFiles = useMemo(
    () => submission.files.filter((f) => f.superseded),
    [submission.files],
  );
  const pendingFiles = useMemo(
    () =>
      currentFiles.filter(
        (f) =>
          f.status === SubmissionStatus.Pending ||
          f.status === SubmissionStatus.UnderReview,
      ),
    [currentFiles],
  );
  const canReviewPending = canReview && pendingFiles.length > 0;
  const mixedStatuses =
    new Set(currentFiles.map((f) => f.status)).size > 1 ||
    currentFiles.some(
      (f) =>
        f.status === SubmissionStatus.Returned ||
        f.status === SubmissionStatus.UnderReview,
    );
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
  const [undoReturnTarget, setUndoReturnTarget] = useState<SubmissionFile | null>(null);

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
    const toastId = `submission-export-${submission.id}`;
    try {
      await requestSubmissionExport(submission.id);
      // Fire-and-forget sticky toast that polls until ready/failed.
      void watchSubmissionExportToast({ submissionId: submission.id, toastId });
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
      toast.success('File reopened for review');
      setReopenTarget(null);
      setExpanded(true);
      setFilesOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to reopen file'));
    }
  }

  async function handleUndoReturn(reason: string) {
    if (!undoReturnTarget) return;
    try {
      await undoReturn.mutateAsync({
        submissionId: submission.id,
        fileId: undoReturnTarget.id,
        reason,
      });
      toast.success('Return undone — file is under review again');
      setUndoReturnTarget(null);
      setExpanded(true);
      setFilesOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to undo return'));
    }
  }

  async function handleUndoAccept(file: SubmissionFile) {
    setReviewingId(file.id);
    try {
      await undoAccept.mutateAsync({
        submissionId: submission.id,
        fileId: file.id,
      });
      toast.success(`Acceptance undone for ${displayFileName(file.fileName)}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to undo acceptance'));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleOpenViewer(file: SubmissionFile) {
    setViewerFile(file);
    if (
      canReview &&
      !file.superseded &&
      file.status === SubmissionStatus.Pending
    ) {
      try {
        await startReview.mutateAsync({
          submissionId: submission.id,
          fileId: file.id,
        });
      } catch {
        // Opening the viewer still works even if claim fails.
      }
    }
  }

  // Keep viewer in sync with list updates (accept / return / claim).
  useEffect(() => {
    if (!viewerFile) return;
    const latest = submission.files.find((f) => f.id === viewerFile.id);
    if (!latest) {
      setViewerFile(null);
      return;
    }
    if (
      latest.status !== viewerFile.status ||
      latest.reviewReason !== viewerFile.reviewReason ||
      latest.superseded !== viewerFile.superseded
    ) {
      setViewerFile(latest);
    }
  }, [submission.files, viewerFile]);

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
            <StatusPill tone={submissionStatusTone(submission.status)}>
              {submission.status === SubmissionStatus.Draft
                ? 'Draft — not sent'
                : formatStatusLabel(submission.status)}
            </StatusPill>
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
            {fileChipSummary(submission.files, submission.status)}
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
          {submission.status === SubmissionStatus.Draft && canReplace ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 px-3 py-2.5">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                {submission.files.filter((f) => !f.superseded).length === 0
                  ? 'No files uploaded yet. Continue to upload — each file is sent to the team as soon as it finishes.'
                  : 'Upload still in progress. Files that finished are already with the team.'}
              </p>
              <Button type="button" size="sm" onClick={onContinueDraft}>
                Continue upload
              </Button>
              {submission.files.filter((f) => !f.superseded).length === 0 ? (
                <Button type="button" size="sm" variant="outline" onClick={onDiscardDraft}>
                  Discard
                </Button>
              ) : null}
            </div>
          ) : null}

          {submission.status !== SubmissionStatus.Draft &&
          canReplace &&
          canClientAttachMore(submission.status) &&
          onAddFiles ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={onAddFiles}>
                <IconUpload className="mr-1.5 h-3.5 w-3.5" />
                Add files
              </Button>
            </div>
          ) : null}

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
                  <span className="truncate">{fileChipSummary(submission.files, submission.status)}</span>
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
                        onOpenViewer={() => void handleOpenViewer(file)}
                        onDownload={() => void handleDownload(file)}
                        onReopen={() => setReopenTarget(file)}
                        onUndoAccept={() => void handleUndoAccept(file)}
                        onUndoReturn={() => setUndoReturnTarget(file)}
                        downloading={downloadingId === file.id}
                        reviewing={reviewingId === file.id}
                        replaceProgress={
                          replaceProgress?.fileId === file.id ? replaceProgress : null
                        }
                        replaceBusy={replaceBusy}
                        onReplace={onReplace}
                        onDiscuss={
                          onDiscussFile && !file.superseded
                            ? () => onDiscussFile(file)
                            : undefined
                        }
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
                              onUndoAccept={() => undefined}
                              onUndoReturn={() => undefined}
                              downloading={downloadingId === file.id}
                              reviewing={false}
                              replaceProgress={null}
                              replaceBusy={false}
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
            if (!open) {
              setViewerFile(null);
              if (returningId === viewerFile.id) {
                setReturningId(null);
                setReturnReason('');
              }
            }
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
          actions={
            <>
              {canReview &&
              !viewerFile.superseded &&
              (viewerFile.status === SubmissionStatus.Pending ||
                viewerFile.status === SubmissionStatus.UnderReview) &&
              returningId !== viewerFile.id ? (
                <>
                  <LoadingButton
                    type="button"
                    size="sm"
                    loading={reviewingId === viewerFile.id}
                    disabled={reviewingId === viewerFile.id}
                    onClick={() => void handleAccept(viewerFile)}
                  >
                    <IconCheck className="mr-1 h-3.5 w-3.5" />
                    Accept
                  </LoadingButton>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={reviewingId === viewerFile.id}
                    onClick={() => {
                      setReturningId(viewerFile.id);
                      setReturnReason('');
                    }}
                  >
                    <IconRotateClockwise className="mr-1 h-3.5 w-3.5" />
                    Return
                  </Button>
                </>
              ) : null}
              {onDiscussFile && !viewerFile.superseded ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onDiscussFile(viewerFile);
                    setViewerFile(null);
                  }}
                >
                  <IconMessage className="mr-1 h-3.5 w-3.5" />
                  Discuss
                </Button>
              ) : null}
            </>
          }
          footerExtra={
            canReview && returningId === viewerFile.id ? (
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3 text-left">
                <p className="text-xs font-medium text-foreground">
                  Return “{displayFileName(viewerFile.fileName, 48)}”
                </p>
                <Textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Explain what to revise…"
                  rows={3}
                  className="text-sm"
                  disabled={reviewingId === viewerFile.id}
                  autoFocus
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={reviewingId === viewerFile.id}
                    onClick={() => {
                      setReturningId(null);
                      setReturnReason('');
                    }}
                  >
                    Cancel
                  </Button>
                  <LoadingButton
                    type="button"
                    size="sm"
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    loading={reviewingId === viewerFile.id}
                    disabled={!returnReason.trim()}
                    onClick={() => void handleConfirmReturn(viewerFile)}
                  >
                    Confirm return
                  </LoadingButton>
                </div>
              </div>
            ) : null
          }
        />
      ) : null}

      <ReasonDialog
        open={Boolean(reopenTarget)}
        onOpenChange={(open) => {
          if (!open) setReopenTarget(null);
        }}
        title="Reopen for review"
        description={`Move “${displayFileName(reopenTarget?.fileName ?? '', 60)}” back to under review. The client will not be asked to replace it until you Return the file.`}
        confirmLabel="Reopen"
        placeholder="Explain why this needs another look…"
        busy={reopenFile.isPending}
        onConfirm={handleReopen}
      />
      <ReasonDialog
        open={Boolean(undoReturnTarget)}
        onOpenChange={(open) => {
          if (!open) setUndoReturnTarget(null);
        }}
        title="Undo return"
        description={`Clear the return on “${displayFileName(undoReturnTarget?.fileName ?? '', 60)}” and put it back under review.`}
        confirmLabel="Undo return"
        placeholder="Explain why the return is being undone…"
        busy={undoReturn.isPending}
        onConfirm={handleUndoReturn}
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
  onDiscussFile,
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
  const [respondOpen, setRespondOpen] = useState(false);
  const [replaceProgress, setReplaceProgress] = useState<ReplaceProgress | null>(null);
  const replaceFile = useReplaceSubmissionFile(requestId);
  const discardDraft = useDiscardDraft(requestId);
  const userId = useAuthStore((s) => s.user?.id);
  const sessionCheckedRef = useRef(false);

  const items = submissions.data?.data ?? [];
  const meta = submissions.data?.meta;
  const ownDraft = useMemo(
    () =>
      userId != null
        ? items.find(
            (s) => s.status === SubmissionStatus.Draft && s.submittedById === userId,
          )
        : undefined,
    [items, userId],
  );
  /** Latest own response that can still receive more files (progressive attach). */
  const ownOpenSubmission = useMemo(() => {
    if (userId == null) return undefined;
    if (ownDraft) return ownDraft;
    return items.find(
      (s) => s.submittedById === userId && canClientAttachMore(s.status),
    );
  }, [items, userId, ownDraft]);
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);
  const attachTarget = useMemo(() => {
    if (attachTargetId) {
      return items.find((s) => s.id === attachTargetId) ?? ownOpenSubmission;
    }
    return ownOpenSubmission;
  }, [attachTargetId, items, ownOpenSubmission]);

  const savedSession = useMemo(
    () => (canRespond ? loadDraftUploadSession(requestId) : null),
    [canRespond, requestId],
  );

  useEffect(() => {
    if (!canRespond || sessionCheckedRef.current) return;
    sessionCheckedRef.current = true;
    const session = loadDraftUploadSession(requestId);
    if (session && isSessionActive(session)) {
      setRespondOpen(true);
    }
  }, [canRespond, requestId]);

  const latestNeedsReview =
    page === 1 &&
    items[0] &&
    items[0].status !== SubmissionStatus.Draft &&
    (items[0].status === SubmissionStatus.Pending ||
      items[0].status === SubmissionStatus.UnderReview ||
      items[0].status === SubmissionStatus.Returned);
  const metricCounts = countsFromSubmissions(metricsSource.data?.data ?? []);

  async function handleReplace(submission: Submission, file: SubmissionFile, browserFile: File) {
    if (browserFile.size > UPLOAD_MAX_BYTES) {
      toast.error(
        `File exceeds maximum size of ${Math.floor(UPLOAD_MAX_BYTES / (1024 * 1024 * 1024))} GB`,
      );
      return;
    }
    setReplaceProgress({
      fileId: file.id,
      fileName: browserFile.name,
      percent: 0,
      sizeBytes: browserFile.size,
    });
    try {
      await replaceFile.mutateAsync({
        submissionId: submission.id,
        replacesFileId: file.id,
        file: browserFile,
        onProgress: (percent) => {
          setReplaceProgress((prev) =>
            prev && prev.fileId === file.id ? { ...prev, percent } : prev,
          );
        },
      });
      toast.success('Replacement uploaded');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to upload replacement'));
    } finally {
      setReplaceProgress(null);
    }
  }

  function openRespondDialog(target?: Submission) {
    setAttachTargetId(target?.id ?? null);
    setRespondOpen(true);
  }

  async function handleDiscardDraft(draftId: string) {
    try {
      await discardDraft.mutateAsync(draftId);
      clearDraftUploadSession(requestId);
      toast.success('Draft discarded');
      if (respondOpen) setRespondOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to discard draft'));
    }
  }

  const sessionIncomplete =
    Boolean(savedSession && isSessionActive(savedSession)) &&
    (savedSession?.files.some((f) => f.status !== 'confirmed' && f.status !== 'done') ?? false);
  const emptyOwnDraft =
    Boolean(ownDraft) && ownDraft!.files.filter((f) => !f.superseded).length === 0;
  const showResumeBanner =
    canRespond && !respondOpen && (sessionIncomplete || emptyOwnDraft);

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn('space-y-3', className)}>
        {!hideMetrics ? <SubmissionMetricCards counts={metricCounts} /> : null}

        {showResumeBanner ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <IconAlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {emptyOwnDraft ? 'Unfinished response' : 'Some uploads did not finish'}
              </p>
              <p className="text-xs text-muted-foreground">
                {emptyOwnDraft
                  ? 'No files sent yet — continue uploading. Each finished file goes to the team immediately.'
                  : 'Files that completed are already with the team. Re-attach only what failed.'}
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => openRespondDialog(ownOpenSubmission)}>
              Continue upload
            </Button>
            {emptyOwnDraft && ownDraft ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void handleDiscardDraft(ownDraft.id)}
              >
                Discard
              </Button>
            ) : null}
          </div>
        ) : null}

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
            <Button
              type="button"
              size="sm"
              onClick={() =>
                openRespondDialog(
                  ownDraft ?? (sessionIncomplete ? ownOpenSubmission : undefined),
                )
              }
            >
              <IconMessageReply className="mr-2 h-4 w-4" />
              {ownDraft || sessionIncomplete
                ? 'Continue response'
                : ownOpenSubmission && ownOpenSubmission.status !== SubmissionStatus.Draft
                  ? 'Add files'
                  : 'Send response'}
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
                const isLatest =
                  page === 1 &&
                  index === 0 &&
                  submission.status !== SubmissionStatus.Draft;
                const needsAttention =
                  submission.status === SubmissionStatus.Draft ||
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
                      replaceProgress={
                        replaceProgress &&
                        submission.files.some((f) => f.id === replaceProgress.fileId)
                          ? replaceProgress
                          : null
                      }
                      replaceBusy={Boolean(replaceProgress) || replaceFile.isPending}
                      onReplace={(f, browserFile) =>
                        void handleReplace(submission, f, browserFile)
                      }
                      onContinueDraft={
                        submission.status === SubmissionStatus.Draft
                          ? () => openRespondDialog(submission)
                          : undefined
                      }
                      onDiscardDraft={
                        submission.status === SubmissionStatus.Draft &&
                        submission.files.filter((f) => !f.superseded).length === 0
                          ? () => void handleDiscardDraft(submission.id)
                          : undefined
                      }
                      onAddFiles={
                        canReplace &&
                        submission.status !== SubmissionStatus.Draft &&
                        canClientAttachMore(submission.status)
                          ? () => openRespondDialog(submission)
                          : undefined
                      }
                      onDiscussFile={
                        onDiscussFile
                          ? (file) =>
                              onDiscussFile({
                                id: file.id,
                                fileName: file.fileName,
                                status: file.status,
                                submissionId: submission.id,
                              })
                          : undefined
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
          <RespondDialog
            requestId={requestId}
            open={respondOpen}
            onOpenChange={(next) => {
              setRespondOpen(next);
              if (!next) setAttachTargetId(null);
            }}
            existingSubmission={attachTarget ?? null}
            resumeSession={savedSession}
          />
        ) : null}
      </div>
    </TooltipProvider>
  );
}

export function RequestSubmissionsTab(props: RequestSubmissionsPanelProps) {
  return <RequestSubmissionsPanel {...props} />;
}
