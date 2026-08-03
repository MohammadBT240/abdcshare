'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ATTACHMENT_ACCEPT,
  FileUpload,
  FormDialog,
  FormField,
  LoadingButton,
  UPLOAD_MAX_BYTES,
} from '@/components/forms';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BffClientError } from '@/lib/bff/client';
import { useUppyUploader } from '@/lib/uploads/uppy-client';
import {
  useCreateDraftSubmission,
  useDiscardDraft,
  useFinalizeSubmission,
} from '@/features/submissions/hooks/use-submissions';
import { cn } from '@/lib/utils';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof BffClientError ? error.message : fallback;
}

function FileProgressList({
  fileStates,
  onRetry,
  disabled,
}: {
  fileStates: Array<{
    id: string;
    name: string;
    percent: number;
    status: string;
    error?: string;
  }>;
  onRetry: (fileId: string) => void;
  disabled?: boolean;
}) {
  if (fileStates.length === 0) return null;
  return (
    <ul className="space-y-2">
      {fileStates.map((f) => (
        <li key={f.id} className="rounded-md border border-border bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-medium text-foreground">{f.name}</span>
            <span className="shrink-0 text-muted-foreground">
              {f.status === 'done' ? 'Done' : f.status === 'failed' ? 'Failed' : `${f.percent}%`}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full transition-[width]',
                f.status === 'failed' ? 'bg-destructive' : 'bg-primary',
              )}
              style={{ width: `${f.status === 'done' ? 100 : f.percent}%` }}
            />
          </div>
          {f.status === 'failed' ? (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="text-xs text-destructive">{f.error || 'Upload failed'}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7"
                disabled={disabled}
                onClick={() => onRetry(f.id)}
              >
                Retry
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RespondDialog({
  requestId,
  open,
  onOpenChange,
}: {
  requestId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const createDraft = useCreateDraftSubmission(requestId);
  const finalize = useFinalizeSubmission(requestId);
  const discard = useDiscardDraft(requestId);

  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'ready'>('idle');

  const uploader = useUppyUploader({ kind: 'submission', parentId: draftId });
  const pendingFilesRef = useRef<File[]>([]);
  const startedForDraft = useRef<string | null>(null);

  function reset() {
    uploader.destroy();
    setMessage('');
    setFiles([]);
    setDraftId(null);
    setBusy(false);
    setPhase('idle');
    pendingFilesRef.current = [];
    startedForDraft.current = null;
  }

  async function discardIfNeeded() {
    if (!draftId) return;
    try {
      await discard.mutateAsync(draftId);
    } catch {
      // 24h sweep cleans orphans
    }
  }

  // When draftId is set with pending files, add + upload once.
  useEffect(() => {
    if (!draftId || !busy || phase !== 'uploading') return;
    if (startedForDraft.current === draftId) return;
    if (pendingFilesRef.current.length === 0 && uploader.fileStates.length === 0) return;

    startedForDraft.current = draftId;
    const toAdd = pendingFilesRef.current;
    pendingFilesRef.current = [];

    void (async () => {
      try {
        if (toAdd.length > 0) uploader.addFiles(toAdd);
        const { allDone } = await uploader.upload();
        if (!allDone) {
          setPhase('ready');
          setBusy(false);
          toast.error('Some files failed to upload — use Retry on each, then send again');
          return;
        }
        await finalize.mutateAsync(draftId);
        toast.success('Response sent for review');
        reset();
        onOpenChange(false);
      } catch (error) {
        setPhase('ready');
        setBusy(false);
        toast.error(errorMessage(error, 'Failed to send response'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, phase, busy]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || files.length === 0 || busy) return;

    // Resume after partial failure: upload remaining / already-added files then finalize.
    if (draftId && phase === 'ready') {
      setBusy(true);
      try {
        const { allDone } = await uploader.upload();
        if (!allDone) {
          setBusy(false);
          toast.error('Some files still failed — retry them individually');
          return;
        }
        await finalize.mutateAsync(draftId);
        toast.success('Response sent for review');
        reset();
        onOpenChange(false);
      } catch (error) {
        setBusy(false);
        toast.error(errorMessage(error, 'Failed to send response'));
      }
      return;
    }

    setBusy(true);
    setPhase('uploading');
    try {
      pendingFilesRef.current = files;
      const draft = await createDraft.mutateAsync(trimmedMessage);
      setDraftId(draft.id);
    } catch (error) {
      setBusy(false);
      setPhase('idle');
      pendingFilesRef.current = [];
      toast.error(errorMessage(error, 'Failed to send response'));
    }
  }

  async function handleRetry(fileId: string) {
    setBusy(true);
    try {
      await uploader.retryFile(fileId);
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
    if (busy && phase === 'uploading') return;
    if (draftId) await discardIfNeeded();
    reset();
    onOpenChange(false);
  }

  const showProgress = uploader.fileStates.length > 0;

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => void handleClose(next)}
      title="Respond to request"
      description="Send your response with at least one supporting file to the engagement team."
      maxWidthClass="sm:max-w-xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleClose(false)}
            disabled={busy && phase === 'uploading'}
          >
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="request-response-form"
            loading={busy}
            disabled={
              !message.trim() ||
              files.length === 0 ||
              (busy && phase === 'uploading') ||
              (showProgress &&
                !uploader.allDone &&
                !uploader.hasFailed &&
                phase === 'uploading')
            }
          >
            {uploader.hasFailed ? 'Send after retries' : 'Send response'}
          </LoadingButton>
        </>
      }
    >
      <form id="request-response-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormField label="Message" htmlFor="submission-message" required>
          <Textarea
            id="submission-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your response and any context the review team needs…"
            rows={6}
            disabled={busy || Boolean(draftId)}
          />
        </FormField>
        <FormField label="Supporting files" required>
          <FileUpload
            files={files}
            onChange={setFiles}
            multiple
            accept={ATTACHMENT_ACCEPT}
            maxBytes={UPLOAD_MAX_BYTES}
            disabled={busy || Boolean(draftId)}
            label="Attach supporting files"
            description="At least one file required. Zip archives are stored as a single file. Progress and retry appear per file after you send."
          />
        </FormField>
        {showProgress ? (
          <FileProgressList
            fileStates={uploader.fileStates}
            onRetry={(id) => void handleRetry(id)}
            disabled={busy && phase === 'uploading'}
          />
        ) : null}
      </form>
    </FormDialog>
  );
}
