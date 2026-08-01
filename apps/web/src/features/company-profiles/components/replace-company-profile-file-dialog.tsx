'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FormDialog, FormField, FileUpload, LoadingButton } from '@/components/forms';
import {
  COMPANY_PROFILE_TYPES,
  DOCUMENT_MAX_BYTES,
} from '@/components/forms/file-validation';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import {
  useReplaceCompanyProfileFile,
  type CompanyProfileRecord,
} from '@/features/company-profiles/hooks/use-company-profiles';

export function ReplaceCompanyProfileFileDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: CompanyProfileRecord | null;
}) {
  const replace = useReplaceCompanyProfileFile();
  const [files, setFiles] = useState<File[]>([]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const file = files[0];
    if (!profile || !file) {
      toast.error('Choose a file to upload');
      return;
    }
    try {
      await replace.mutateAsync({ id: profile.id, file });
      toast.success('File replaced');
      setFiles([]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Replace failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFiles([]);
        onOpenChange(next);
      }}
      title="Replace file"
      description={profile ? `Replace the file for “${profile.name}”.` : undefined}
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="replace-company-profile-form"
            loading={replace.isPending}
            disabled={files.length === 0}
          >
            Replace
          </LoadingButton>
        </>
      }
    >
      <form id="replace-company-profile-form" onSubmit={handleSubmit}>
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
      </form>
    </FormDialog>
  );
}
