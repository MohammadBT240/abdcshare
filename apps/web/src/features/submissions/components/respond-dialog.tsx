'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconWifiOff, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import { SubmissionStatus } from '@abdcshare/shared';
import {
  ATTACHMENT_ACCEPT,
  FileUpload,
  FormDialog,
  FormField,
  LoadingButton,
  UPLOAD_MAX_BYTES,
} from '@/components/forms';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError, bffApi } from '@/lib/bff/client';
import { useOnlineStatus, useUppyUploader } from '@/lib/uploads/uppy-client';
import {
  type Submission,
  type SubmissionFile,
  useCreateDraftSubmission,
  useDiscardDraft,
  useFinalizeSubmission,
} from '@/features/submissions/hooks/use-submissions';
import {
  clearDraftUploadSession,
  fileIdentity,
  loadDraftUploadSession,
  saveDraftUploadSession,
  type DraftUploadPhase,
  type DraftUploadSession,
  type PersistedFileMeta,
} from '@/features/submissions/lib/draft-upload-session';
import { cn } from '@/lib/utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof BffClientError ? error.message : fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isOpenForAttach(status: SubmissionStatus): boolean {
  return (
    status === SubmissionStatus.Draft ||
    status === SubmissionStatus.Pending ||
    status === SubmissionStatus.UnderReview ||
    status === SubmissionStatus.Returned
  );
}

type QueueRow = {
  key: string;
  name: string;
  size: number;
  mimeType?: string;
  uppyId?: string;
  percent: number;
  status: 'queued' | 'uploading' | 'failed' | 'done';
  error?: string;
  file?: File;
};

function UploadQueueList({
  rows,
  onRemove,
  onRetry,
  disabled,
}: {
  rows: QueueRow[];
  onRemove: (row: QueueRow) => void;
  onRetry: (uppyId: string) => void;
  disabled?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="rounded-md border border-border bg-card px-3 py-2">
          <div className="flex items-start gap-2">
            <FileTypeIcon
              fileName={row.name}
              mimeType={row.mimeType}
              size={18}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">
                  {row.name}
                  <span className="ml-1 font-normal text-muted-foreground">
                    ({formatBytes(row.size)})
                  </span>
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {row.status === 'done'
                    ? 'Sent'
                    : row.status === 'failed'
                      ? 'Failed'
                      : row.status === 'queued'
                        ? 'Ready'
                        : `${row.percent}%`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    'h-full transition-[width]',
                    row.status === 'failed'
                      ? 'bg-destructive'
                      : row.status === 'done'
                        ? 'bg-primary'
                        : 'bg-primary',
                  )}
                  style={{
                    width: `${
                      row.status === 'done' ? 100 : row.status === 'queued' ? 0 : row.percent
                    }%`,
                  }}
                />
              </div>
              {row.status === 'failed' ? (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-destructive">{row.error || 'Upload failed'}</p>
                  {row.uppyId ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7"
                      disabled={disabled}
                      onClick={() => onRetry(row.uppyId!)}
                    >
                      Retry
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
            {row.status !== 'done' ? (
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-40"
                disabled={disabled && row.status === 'uploading'}
                onClick={() => onRemove(row)}
                aria-label={`Remove ${row.name}`}
              >
                <IconX className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ConfirmedFilesList({ files }: { files: SubmissionFile[] }) {
  const current = files.filter((f) => !f.superseded);
  if (current.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-muted/10 px-3 py-2">
      <p className="text-xs font-medium text-muted-foreground">
        Already with the team ({current.length})
      </p>
      <ul className="mt-1.5 space-y-1">
        {current.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate text-foreground">{f.fileName}</span>
            <span className="shrink-0 text-emerald-600 dark:text-emerald-400">
              {f.status === SubmissionStatus.Draft ? 'Uploaded' : 'Sent'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MissingFilesHint({ missing }: { missing: PersistedFileMeta[] }) {
  if (missing.length === 0) return null;
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
        <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" />
        Re-attach files that did not finish uploading
      </p>
      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
        {missing.map((f) => (
          <li key={fileIdentity(f)} className="truncate">
            {f.name} ({formatBytes(f.size)})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RespondDialog({
  requestId,
  open,
  onOpenChange,
  existingSubmission,
  resumeSession,
}: {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Draft shell or open response the client can still attach files to. */
  existingSubmission?: Submission | null;
  resumeSession?: DraftUploadSession | null;
}) {
  const qc = useQueryClient();
  const createDraft = useCreateDraftSubmission(requestId);
  const finalize = useFinalizeSubmission(requestId);
  const discard = useDiscardDraft(requestId);
  const online = useOnlineStatus();

  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submissionStatus, setSubmissionStatus] = useState<SubmissionStatus | null>(null);
  const [confirmedFiles, setConfirmedFiles] = useState<SubmissionFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<DraftUploadPhase>('idle');
  const [missingFromSession, setMissingFromSession] = useState<PersistedFileMeta[]>([]);
  const [discardConfirm, setDiscardConfirm] = useState(false);

  const uploader = useUppyUploader({ kind: 'submission', parentId: submissionId });
  const pendingFilesRef = useRef<File[]>([]);
  const startedForSubmission = useRef<string | null>(null);
  const userIntentSendRef = useRef(false);
  const resumeAttemptedRef = useRef(false);
  const hydratedRef = useRef(false);

  const isPublished =
    submissionStatus != null && submissionStatus !== SubmissionStatus.Draft;
  const canDiscard = Boolean(submissionId) && !isPublished && confirmedFiles.length === 0;

  async function invalidateLists() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['requests', requestId, 'submissions'] }),
      qc.invalidateQueries({ queryKey: ['requests', requestId] }),
      submissionId
        ? qc.invalidateQueries({ queryKey: ['submissions', submissionId] })
        : Promise.resolve(),
    ]);
  }

  async function refreshSubmission(id: string) {
    try {
      const latest = await bffApi<Submission>(`/api/submissions/${id}`);
      setSubmissionStatus(latest.status);
      setConfirmedFiles(latest.files.filter((f) => !f.superseded));
      setMessage(latest.message);
      return latest;
    } catch {
      return null;
    }
  }

  const persistSession = useCallback(
    (overrides?: Partial<DraftUploadSession>) => {
      if (!submissionId) return;
      const confirmedNames = new Set(confirmedFiles.map((f) => f.fileName));
      const fromUppy = uploader.fileStates.map((f) => ({
        name: f.name,
        size: 0,
        lastModified: 0,
        status: f.status,
        percent: f.percent,
        error: f.error,
      }));
      const pendingMeta: PersistedFileMeta[] = files.map((f) => {
        const uppyMatch = uploader.fileStates.find((u) => u.name === f.name);
        return {
          name: f.name,
          size: f.size,
          lastModified: f.lastModified,
          status: uppyMatch?.status ?? 'queued',
          percent: uppyMatch?.percent,
          error: uppyMatch?.error,
        };
      });
      const confirmedMeta: PersistedFileMeta[] = confirmedFiles.map((f) => ({
        name: f.fileName,
        size: f.sizeBytes ?? 0,
        lastModified: 0,
        status: 'confirmed' as const,
      }));
      const merged = [...confirmedMeta];
      for (const p of pendingMeta.length > 0 ? pendingMeta : fromUppy) {
        if (!confirmedNames.has(p.name)) merged.push(p);
      }

      saveDraftUploadSession({
        requestId,
        draftId: submissionId,
        message,
        phase,
        files: merged,
        userIntentSend: userIntentSendRef.current,
        updatedAt: new Date().toISOString(),
        ...overrides,
      });
    },
    [confirmedFiles, submissionId, files, message, phase, requestId, uploader.fileStates],
  );

  const clearSession = useCallback(() => {
    clearDraftUploadSession(requestId);
  }, [requestId]);

  function resetLocal() {
    uploader.destroy();
    setMessage('');
    setFiles([]);
    setSubmissionId(null);
    setSubmissionStatus(null);
    setConfirmedFiles([]);
    setBusy(false);
    setPhase('idle');
    setMissingFromSession([]);
    setDiscardConfirm(false);
    pendingFilesRef.current = [];
    startedForSubmission.current = null;
    userIntentSendRef.current = false;
    resumeAttemptedRef.current = false;
    hydratedRef.current = false;
  }

  async function discardDraftAndReset() {
    if (submissionId && !isPublished) {
      try {
        await discard.mutateAsync(submissionId);
      } catch {
        // 24h sweep cleans orphans
      }
    }
    clearSession();
    resetLocal();
  }

  useEffect(() => {
    if (!open) hydratedRef.current = false;
  }, [open]);

  /**
   * Progressive upload: each confirmed file is already Pending / visible to staff.
   * We only retry failures, refresh the list, and clear the session when the batch is done.
   */
  const attemptUpload = useCallback(async () => {
    if (!submissionId) return;
    if (!online) {
      setPhase('waiting-network');
      persistSession({ phase: 'waiting-network' });
      return;
    }

    setBusy(true);
    setPhase('uploading');
    persistSession({ phase: 'uploading' });

    try {
      const hasUppyFiles = uploader.fileStates.length > 0 || pendingFilesRef.current.length > 0;
      let uploadsComplete = true;

      if (pendingFilesRef.current.length > 0) {
        uploader.addFiles(pendingFilesRef.current);
        pendingFilesRef.current = [];
      }

      if (uploader.fileStates.length > 0 || hasUppyFiles) {
        if (uploader.hasFailed) {
          const retried = await uploader.retryAllFailed();
          uploadsComplete = retried.allDone;
        } else {
          const result = await uploader.upload();
          uploadsComplete = result.allDone;
        }
      }

      // Refresh so confirmed files (published via confirm API) appear immediately.
      const latest = await refreshSubmission(submissionId);
      await invalidateLists();

      // Safety: publish any leftover Draft shell (idempotent if already Pending).
      if (latest?.status === SubmissionStatus.Draft && (latest.files?.length ?? 0) > 0) {
        await finalize.mutateAsync(submissionId);
        await refreshSubmission(submissionId);
      }

      if (!uploadsComplete) {
        setPhase('ready');
        setBusy(false);
        persistSession({ phase: 'ready' });
        toast.error('Some files failed — successful ones are already with the team. Retry the rest.');
        return;
      }

      const doneCount = uploader.fileStates.filter((f) => f.status === 'done').length;
      toast.success(
        doneCount > 0
          ? `${doneCount} file${doneCount === 1 ? '' : 's'} sent — the team can review them now`
          : 'Files sent for review',
      );
      clearSession();
      setFiles([]);
      setMissingFromSession([]);
      setBusy(false);
      setPhase('ready');
      startedForSubmission.current = null;
      // Keep dialog open so client can add more; parent list already refreshed.
    } catch (error) {
      setPhase('ready');
      setBusy(false);
      persistSession({ phase: 'ready' });
      await refreshSubmission(submissionId).catch(() => null);
      await invalidateLists();
      toast.error(errorMessage(error, 'Upload failed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    submissionId,
    online,
    persistSession,
    clearSession,
    finalize,
    uploader,
  ]);

  function hydrateFromSubmission(sub: Submission, session: DraftUploadSession | null) {
    setSubmissionId(sub.id);
    setSubmissionStatus(sub.status);
    setMessage(sub.message);
    setConfirmedFiles(sub.files.filter((f) => !f.superseded));

    if (session && session.draftId === sub.id) {
      userIntentSendRef.current = session.userIntentSend;
      setPhase(session.phase === 'idle' ? 'ready' : session.phase);
      const confirmedNames = new Set(sub.files.map((f) => f.fileName));
      const missing = session.files.filter(
        (f) => f.status !== 'confirmed' && f.status !== 'done' && !confirmedNames.has(f.name),
      );
      setMissingFromSession(missing);
    } else {
      setPhase('ready');
    }
    hydratedRef.current = true;
  }

  useEffect(() => {
    if (!open) return;

    const session = resumeSession ?? loadDraftUploadSession(requestId);
    const existing = existingSubmission ?? null;

    if (!existing && !session) {
      if (hydratedRef.current || submissionId) resetLocal();
      return;
    }

    if (hydratedRef.current) return;

    if (existing && isOpenForAttach(existing.status)) {
      hydrateFromSubmission(existing, session);
      return;
    }

    if (session?.draftId && session.requestId === requestId) {
      setSubmissionId(session.draftId);
      setMessage(session.message);
      setPhase(session.phase === 'idle' ? 'ready' : session.phase);
      userIntentSendRef.current = session.userIntentSend;
      const missing = session.files.filter((f) => f.status !== 'confirmed' && f.status !== 'done');
      setMissingFromSession(missing);
      hydratedRef.current = true;
      void refreshSubmission(session.draftId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existingSubmission, resumeSession, requestId]);

  useEffect(() => {
    if (!submissionId || !open) return;
    persistSession();
  }, [submissionId, open, message, phase, files, uploader.fileStates, confirmedFiles, persistSession]);

  useEffect(() => {
    if (!submissionId || !busy || phase !== 'uploading') return;
    if (startedForSubmission.current === submissionId) return;
    startedForSubmission.current = submissionId;
    void attemptUpload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, phase, busy]);

  useEffect(() => {
    if (!open || !submissionId || !online) return;
    if (!userIntentSendRef.current) return;
    if (phase !== 'waiting-network' && !uploader.hasFailed) return;
    if (resumeAttemptedRef.current) return;

    resumeAttemptedRef.current = true;
    setBusy(true);
    setPhase('uploading');
    startedForSubmission.current = null;
    void attemptUpload().finally(() => {
      resumeAttemptedRef.current = false;
    });
  }, [online, open, submissionId, phase, uploader.hasFailed, attemptUpload]);

  useEffect(() => {
    if (!open || online || !submissionId) return;
    if (phase === 'uploading' || uploader.isUploading) {
      setPhase('waiting-network');
      setBusy(false);
      persistSession({ phase: 'waiting-network' });
    }
  }, [online, open, submissionId, phase, uploader.isUploading, persistSession]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || files.length === 0 || busy) return;

    userIntentSendRef.current = true;

    if (submissionId && (phase === 'ready' || phase === 'waiting-network')) {
      setBusy(true);
      setPhase('uploading');
      persistSession({ phase: 'uploading', userIntentSend: true });
      pendingFilesRef.current = files;
      startedForSubmission.current = null;
      return;
    }

    setBusy(true);
    setPhase('uploading');

    try {
      pendingFilesRef.current = files;
      if (submissionId) {
        startedForSubmission.current = null;
        return;
      }

      if (existingSubmission && isOpenForAttach(existingSubmission.status)) {
        setSubmissionId(existingSubmission.id);
        setSubmissionStatus(existingSubmission.status);
        setConfirmedFiles(existingSubmission.files.filter((f) => !f.superseded));
        startedForSubmission.current = null;
        return;
      }

      const draft = await createDraft.mutateAsync(trimmedMessage);
      setSubmissionId(draft.id);
      setSubmissionStatus(draft.status);
      setConfirmedFiles(draft.files.filter((f) => !f.superseded));
      startedForSubmission.current = null;
    } catch (error) {
      setBusy(false);
      setPhase('idle');
      pendingFilesRef.current = [];
      userIntentSendRef.current = false;
      toast.error(errorMessage(error, 'Failed to start response'));
    }
  }

  async function handleRetry(fileId: string) {
    if (!online) {
      toast.error('You are offline — uploads will resume when connection returns');
      return;
    }
    setBusy(true);
    try {
      await uploader.retryFile(fileId);
      await refreshSubmission(submissionId!);
      await invalidateLists();
      if (uploader.allDone) {
        toast.success('File sent — the team can review it now');
        clearSession();
        setFiles([]);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Retry failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleClose(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (busy && phase === 'uploading' && online) return;

    if (submissionId && (uploader.hasFailed || files.length > 0)) {
      persistSession();
    } else if (submissionId && isPublished) {
      clearSession();
    } else if (submissionId) {
      persistSession();
    } else {
      resetLocal();
    }
    onOpenChange(false);
  }

  async function handleDiscard() {
    if (!canDiscard) return;
    if (!discardConfirm) {
      setDiscardConfirm(true);
      return;
    }
    await discardDraftAndReset();
    toast.success('Draft discarded');
    onOpenChange(false);
  }

  const showProgress = uploader.fileStates.length > 0;
  const hasSubmission = Boolean(submissionId);
  const canSend =
    message.trim().length > 0 &&
    files.length > 0 &&
    !(busy && phase === 'uploading' && online);

  const waitingOffline =
    phase === 'waiting-network' || (!online && hasSubmission && userIntentSendRef.current);

  const queueRows = useMemo((): QueueRow[] => {
    const byName = new Map(uploader.fileStates.map((s) => [s.name, s]));
    return files.map((file, index) => {
      const state = byName.get(file.name);
      return {
        key: `${file.name}:${file.size}:${file.lastModified}:${index}`,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        uppyId: state?.id,
        percent: state?.percent ?? 0,
        status: (state?.status as QueueRow['status']) ?? 'queued',
        error: state?.error,
        file,
      };
    });
  }, [files, uploader.fileStates]);

  function handleRemoveRow(row: QueueRow) {
    if (row.status === 'done') return;
    if (row.uppyId) uploader.removeFile(row.uppyId);
    else uploader.removeFileByName(row.name);
    setFiles((prev) =>
      prev.filter(
        (f) =>
          !(
            f.name === row.name &&
            f.size === row.size &&
            f.lastModified === (row.file?.lastModified ?? f.lastModified)
          ),
      ),
    );
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => void handleClose(next)}
      title={isPublished ? 'Add files to response' : hasSubmission ? 'Continue your response' : 'Respond to request'}
      description={
        isPublished
          ? 'Each file is sent to the team as soon as it finishes uploading. You can keep adding more.'
          : 'Each file is sent for review as soon as it uploads. You do not need to wait for every file.'
      }
      maxWidthClass="sm:max-w-xl"
      footer={
        <>
          {canDiscard ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto text-destructive hover:text-destructive"
              onClick={() => void handleDiscard()}
              disabled={busy && phase === 'uploading'}
            >
              {discardConfirm ? 'Confirm discard' : 'Discard draft'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleClose(false)}
            disabled={busy && phase === 'uploading' && online}
          >
            Done
          </Button>
          <LoadingButton
            type="submit"
            form="request-response-form"
            loading={busy && phase === 'uploading' && online}
            disabled={
              !canSend ||
              (showProgress &&
                !uploader.allDone &&
                !uploader.hasFailed &&
                phase === 'uploading' &&
                online)
            }
          >
            {waitingOffline
              ? 'Waiting for connection…'
              : uploader.hasFailed
                ? 'Retry failed uploads'
                : isPublished
                  ? 'Upload files'
                  : 'Upload & send'}
          </LoadingButton>
        </>
      }
    >
      <form id="request-response-form" className="space-y-4" onSubmit={handleSubmit}>
        {waitingOffline ? (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <IconWifiOff className="h-4 w-4 shrink-0" />
            Connection lost — finished files stay with the team. Remaining uploads resume when you are
            back online.
          </div>
        ) : null}

        <FormField label="Message" htmlFor="submission-message" required>
          <Textarea
            id="submission-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your response and any context the review team needs…"
            rows={6}
            disabled={busy || hasSubmission}
          />
        </FormField>

        <ConfirmedFilesList files={confirmedFiles} />
        <MissingFilesHint missing={missingFromSession} />

        <FormField
          label={hasSubmission ? 'Add files' : 'Supporting files'}
          required={confirmedFiles.length === 0}
        >
          <FileUpload
            files={files}
            onChange={setFiles}
            multiple
            accept={ATTACHMENT_ACCEPT}
            maxBytes={UPLOAD_MAX_BYTES}
            disabled={busy && phase === 'uploading' && online}
            hideFileList
            label={hasSubmission ? 'Attach more files' : 'Attach supporting files'}
            description="Each file is sent to the engagement team as soon as it finishes uploading."
          />
        </FormField>

        <UploadQueueList
          rows={queueRows}
          onRemove={handleRemoveRow}
          onRetry={(id) => void handleRetry(id)}
          disabled={(busy && phase === 'uploading') || !online}
        />

        {hasSubmission && !isPublished ? (
          <p className="text-[11px] text-muted-foreground">
            Unpublished drafts are removed after 24 hours. Once the first file uploads, the team can
            start reviewing.
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
