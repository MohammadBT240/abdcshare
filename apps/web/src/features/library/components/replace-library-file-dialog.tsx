'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { FileUpload, FormDialog, LoadingButton } from '@/components/forms';
import { Button } from '@/components/ui/button';
import { BffClientError } from '@/lib/bff/client';
import { useReplaceLibraryFile } from '@/features/library/hooks/use-library';
import {
  LIBRARY_ACCEPT,
  LIBRARY_FILE_HINT,
  LIBRARY_MAX_BYTES,
  LIBRARY_TYPES,
  withLibraryMime,
} from '@/features/library/lib/library-files';
import type { LibraryItem } from '@/features/library/types';

export function ReplaceLibraryFileDialog({
  item,
  open,
  onOpenChange,
}: {
  item: LibraryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const replace = useReplaceLibraryFile();
  const [files, setFiles] = useState<File[]>([]);
  const [percent, setPercent] = useState<number | null>(null);

  function close(next: boolean) {
    if (replace.isPending) return;
    if (!next) {
      setFiles([]);
      setPercent(null);
    }
    onOpenChange(next);
  }

  async function submit() {
    const file = files[0];
    if (!item || !file) return;
    try {
      setPercent(0);
      await replace.mutateAsync({ id: item.id, file, onProgress: setPercent });
      toast.success('File replaced');
      setFiles([]);
      setPercent(null);
      onOpenChange(false);
    } catch (err) {
      setPercent(null);
      toast.error(err instanceof BffClientError ? err.message : err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={close}
      title="Replace file"
      description={
        item?.fileName
          ? `Replaces “${item.fileName}”. Title, tags and other details stay the same; the old file is removed.`
          : undefined
      }
      maxWidthClass="sm:max-w-lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => close(false)} disabled={replace.isPending}>
            Cancel
          </Button>
          <LoadingButton type="button" loading={replace.isPending} disabled={!files.length} onClick={() => void submit()}>
            {replace.isPending && percent != null ? `Uploading ${percent}%` : 'Replace'}
          </LoadingButton>
        </>
      }
    >
      <FileUpload
        files={files}
        onChange={(next) => {
          const normalized = next.map(withLibraryMime);
          if (normalized.some((f) => !LIBRARY_TYPES.has(f.type))) {
            toast.error(`That file type isn't supported. ${LIBRARY_FILE_HINT}`);
            return;
          }
          setFiles(normalized);
        }}
        accept={LIBRARY_ACCEPT}
        maxBytes={LIBRARY_MAX_BYTES}
        disabled={replace.isPending}
        label="Drop the new file here"
        description={LIBRARY_FILE_HINT}
      />
    </FormDialog>
  );
}
