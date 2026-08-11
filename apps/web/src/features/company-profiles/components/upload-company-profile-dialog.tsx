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
import { useCreateCompanyProfile } from '@/features/company-profiles/hooks/use-company-profiles';

export function UploadCompanyProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateCompanyProfile();
  const [name, setName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [percent, setPercent] = useState<number | null>(null);

  function reset() {
    setName('');
    setFiles([]);
    setPercent(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = files[0];
    if (!name.trim() || !file) {
      toast.error('Name and file are required');
      return;
    }
    try {
      setPercent(0);
      await create.mutateAsync({
        name: name.trim(),
        file,
        onProgress: (p) => setPercent(p),
      });
      toast.success('Company profile uploaded');
      reset();
      onOpenChange(false);
    } catch (err) {
      setPercent(null);
      toast.error(err instanceof BffClientError ? err.message : err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Upload company profile"
      description="Add a named document for staff reference. PDF, DOC, or DOCX up to 100 MB."
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="upload-company-profile-form"
            loading={create.isPending}
            disabled={!name.trim() || files.length === 0}
          >
            {create.isPending && percent != null ? `Upload ${percent}%` : 'Upload'}
          </LoadingButton>
        </>
      }
    >
      <form id="upload-company-profile-form" onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Name" required htmlFor="company-profile-name">
          <Input
            id="company-profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. ACA capability statement 2026"
            maxLength={255}
          />
        </FormField>
        <FormField label="Document" required>
          <FileUpload
            files={files}
            onChange={setFiles}
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            allowedTypes={COMPANY_PROFILE_TYPES}
            maxBytes={DOCUMENT_MAX_BYTES}
            description="PDF, DOC, or DOCX — up to 100 MB."
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
