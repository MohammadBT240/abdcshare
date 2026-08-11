'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, FileUpload, LoadingButton } from '@/components/forms';
import {
  COMPANY_PROFILE_TYPES,
  DOCUMENT_MAX_BYTES,
} from '@/components/forms/file-validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BffClientError } from '@/lib/bff/client';
import { useCreateSupportingDocument } from '@/features/documents/hooks/use-supporting-documents';

export function UploadPlanningDocumentDialog({
  open,
  onOpenChange,
  engagementId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
}) {
  const create = useCreateSupportingDocument(engagementId);
  const [title, setTitle] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [percent, setPercent] = useState<number | null>(null);

  function reset() {
    setTitle('');
    setFiles([]);
    setPercent(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = files[0];
    if (!title.trim() || !file) {
      toast.error('Title and file are required');
      return;
    }
    try {
      setPercent(0);
      await create.mutateAsync({
        title: title.trim(),
        file,
        onProgress: (p) => setPercent(p),
      });
      toast.success('Planning document uploaded');
      reset();
      onOpenChange(false);
    } catch (err) {
      setPercent(null);
      toast.error(
        err instanceof BffClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Upload failed',
      );
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Upload planning document"
      description="Engagement-level preliminaries such as engagement or appointment letters. Not working papers."
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="upload-planning-document-form"
            loading={create.isPending}
            disabled={!title.trim() || files.length === 0}
          >
            {create.isPending && percent != null ? `Upload ${percent}%` : 'Upload'}
          </LoadingButton>
        </>
      }
    >
      <form id="upload-planning-document-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Title" required htmlFor="planning-doc-title">
          <Input
            id="planning-doc-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Engagement letter"
            maxLength={255}
          />
        </FormField>
        <FormField label="File" required>
          <FileUpload
            files={files}
            onChange={setFiles}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            allowedTypes={COMPANY_PROFILE_TYPES}
            maxBytes={DOCUMENT_MAX_BYTES}
            description="PDF, DOC, or DOCX — up to 100 MB. Phase: Planning."
          />
        </FormField>
        {create.isPending && percent != null ? (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${Math.min(100, percent)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Uploading to storage… {percent}%</p>
          </div>
        ) : null}
      </form>
    </FormDialog>
  );
}
