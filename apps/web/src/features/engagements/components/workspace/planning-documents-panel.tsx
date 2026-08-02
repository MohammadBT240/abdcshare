'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { IconDownload, IconPlus, IconTrash } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { BffClientError } from '@/lib/bff/client';
import {
  downloadSupportingDocument,
  useDeleteSupportingDocument,
  useSupportingDocuments,
  type SupportingDocument,
} from '@/features/documents/hooks/use-supporting-documents';
import { UploadPlanningDocumentDialog } from './upload-planning-document-dialog';

interface PlanningDocumentsPanelProps {
  engagementId: string;
  canUpload: boolean;
  canDelete: boolean;
}

export function PlanningDocumentsPanel({
  engagementId,
  canUpload,
  canDelete,
}: PlanningDocumentsPanelProps) {
  const docs = useSupportingDocuments(engagementId);
  const remove = useDeleteSupportingDocument(engagementId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleting, setDeleting] = useState<SupportingDocument | null>(null);

  async function handleDownload(doc: SupportingDocument) {
    try {
      await downloadSupportingDocument(doc);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Download failed');
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await remove.mutateAsync(deleting.id);
      toast.success('Document deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err instanceof BffClientError ? err.message : 'Delete failed');
    }
  }

  const rows = docs.data?.data ?? [];

  return (
    <>
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">Planning documents</h3>
            <p className="text-xs text-muted-foreground">
              Letters and packs — not working papers
            </p>
          </div>
          {canUpload ? (
            <Button onClick={() => setUploadOpen(true)} size="sm">
              <IconPlus className="mr-1.5 h-4 w-4" />
              Upload
            </Button>
          ) : null}
        </div>

        {docs.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
            No planning documents yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {rows.map((doc) => {
              const latest = doc.files?.[0];
              return (
              <li
                key={doc.id}
                className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
              >
                <FileTypeIcon
                  fileName={latest?.fileName}
                  mimeType={latest?.mimeType}
                  kind={latest ? undefined : 'folder'}
                  size={18}
                />
                <p className="min-w-0 flex-1 truncate font-medium">{doc.title}</p>
                <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                  {doc.phase ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {doc.phase}
                    </Badge>
                  ) : null}
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                  {doc.currentVersion > 0 ? <span>v{doc.currentVersion}</span> : null}
                </div>
                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => void handleDownload(doc)}
                    disabled={doc.currentVersion < 1}
                    aria-label={`Download ${doc.title}`}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                  </Button>
                  {canDelete ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setDeleting(doc)}
                      aria-label={`Delete ${doc.title}`}
                    >
                      <IconTrash className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <UploadPlanningDocumentDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        engagementId={engagementId}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete planning document?"
        description="This permanently removes the document and its files."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        variant="destructive"
        confirming={remove.isPending}
      />
    </>
  );
}
