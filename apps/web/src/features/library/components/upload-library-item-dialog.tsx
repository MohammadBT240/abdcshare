'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FileUpload, FormDialog, FormField, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import { useUploadLibraryItem } from '@/features/library/hooks/use-library';
import {
  EMPTY_LIBRARY_FORM,
  LibraryItemFieldsForm,
  fieldsFromForm,
  validateLibraryForm,
  type LibraryFormState,
} from '@/features/library/components/library-item-fields';
import {
  LIBRARY_ACCEPT,
  LIBRARY_FILE_HINT,
  LIBRARY_MAX_BYTES,
  LIBRARY_TYPES,
  titleFromFileName,
  withLibraryMime,
} from '@/features/library/lib/library-files';

const FORM_ID = 'upload-library-item-form';

export function UploadLibraryItemDialog({
  open,
  onOpenChange,
  defaultCategoryId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const upload = useUploadLibraryItem();
  const [form, setForm] = useState<LibraryFormState>(EMPTY_LIBRARY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [percent, setPercent] = useState<number | null>(null);
  /** Kept after a failed upload so a retry reuses the same item instead of creating another. */
  const [draftId, setDraftId] = useState<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function rememberDraft(id: string) {
    draftRef.current = id;
    setDraftId(id);
  }

  function reset() {
    draftRef.current = null;
    setForm({ ...EMPTY_LIBRARY_FORM, categoryId: defaultCategoryId ?? '' });
    setFiles([]);
    setPercent(null);
    setDraftId(null);
    setError(null);
  }

  // Fresh form each time the dialog opens (pre-select the category being browsed).
  useEffect(() => {
    if (!open) return;
    draftRef.current = null;
    setForm({ ...EMPTY_LIBRARY_FORM, categoryId: defaultCategoryId ?? '' });
    setFiles([]);
    setPercent(null);
    setDraftId(null);
    setError(null);
  }, [open, defaultCategoryId]);

  function handleOpenChange(next: boolean) {
    if (upload.isPending) return; // don't abandon an in-flight upload
    onOpenChange(next);
  }

  function handleFiles(next: File[]) {
    // Browsers sometimes report an empty MIME; validate on the type inferred from the extension.
    const normalized = next.map(withLibraryMime);
    if (normalized.some((f) => !LIBRARY_TYPES.has(f.type))) {
      setError(`That file type isn't supported. ${LIBRARY_FILE_HINT}`);
      return;
    }
    setError(null);
    setFiles(normalized);
    const file = normalized[0];
    if (file && !form.title.trim()) setForm((f) => ({ ...f, title: titleFromFileName(file.name) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = files[0];
    const invalid = !file ? 'Choose a file to upload' : validateLibraryForm(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    try {
      setPercent(0);
      const item = await upload.mutateAsync({
        fields: fieldsFromForm(form),
        file: file!,
        draftId,
        onDraftCreated: rememberDraft,
        onProgress: setPercent,
      });
      toast.success('Added to the library', {
        description: item.title,
        action: { label: 'Open', onClick: () => router.push(`/library/${item.id}`) },
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      setPercent(null);
      const message =
        err instanceof BffClientError ? err.message : err instanceof Error ? err.message : 'Upload failed';
      setError(draftRef.current ? `${message}. Your details are kept — press Retry upload.` : message);
    }
  }

  const busy = upload.isPending;

  return (
    <FormDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Add to the library"
      description="Share a report, paper or material with the firm. It is visible as soon as the upload finishes."
      maxWidthClass="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <LoadingButton type="submit" form={FORM_ID} loading={busy} disabled={files.length === 0}>
            {busy && percent != null ? `Uploading ${percent}%` : draftId ? 'Retry upload' : 'Upload'}
          </LoadingButton>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <FormField label="File" required>
          <FileUpload
            files={files}
            onChange={handleFiles}
            accept={LIBRARY_ACCEPT}
            maxBytes={LIBRARY_MAX_BYTES}
            disabled={busy}
            label="Drop a file here"
            description={LIBRARY_FILE_HINT}
          />
        </FormField>

        <LibraryItemFieldsForm value={form} onChange={setForm} disabled={busy} />

        {busy && percent != null ? (
          <div className="space-y-1" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {percent < 100 ? `Uploading… ${percent}%` : 'Finishing up…'}
            </p>
          </div>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </FormDialog>
  );
}
