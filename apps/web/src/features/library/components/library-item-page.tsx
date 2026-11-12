'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconArchive,
  IconArrowLeft,
  IconDots,
  IconDownload,
  IconEye,
  IconLock,
  IconPencil,
  IconReplace,
  IconRestore,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { ConfirmDialog, LoadingButton } from '@/components/forms';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { BffClientError } from '@/lib/bff/client';
import {
  downloadLibraryItem,
  useArchiveLibraryItem,
  useDeleteLibraryItem,
  useLibraryItem,
} from '@/features/library/hooks/use-library';
import { LibraryViewer } from '@/features/library/components/library-viewer';
import { EditLibraryItemDialog } from '@/features/library/components/edit-library-item-dialog';
import { ReplaceLibraryFileDialog } from '@/features/library/components/replace-library-file-dialog';
import { fileTypeLabel, formatBytes, formatDate } from '@/features/library/lib/library-files';

function errorMessage(err: unknown, fallback: string) {
  return err instanceof BffClientError ? err.message : err instanceof Error ? err.message : fallback;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

export function LibraryItemPage({ id }: { id: string }) {
  const router = useRouter();
  const item = useLibraryItem(id);
  const archive = useArchiveLibraryItem();
  const remove = useDeleteLibraryItem();
  const [editOpen, setEditOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadLibraryItem(id);
    } catch (err) {
      toast.error(errorMessage(err, 'Download failed'));
    } finally {
      setDownloading(false);
    }
  }

  if (item.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-[70vh] w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (item.isError || !item.data) {
    const notFound = item.error instanceof BffClientError && item.error.statusCode === 404;
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-foreground">
          {notFound ? "This item doesn't exist or you don't have access to it." : 'The item could not be loaded.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/library">
            <IconArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back to the library
          </Link>
        </Button>
      </div>
    );
  }

  const data = item.data;
  const archived = data.status === 'Archived';

  return (
    <div>
      <PageToolbar
        title={data.title}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Library', href: '/library' },
          { label: data.category.name, href: `/library?category=${data.category.id}` },
        ]}
        actions={
          <div className="flex shrink-0 items-center gap-2">
            <LoadingButton type="button" loading={downloading} onClick={() => void handleDownload()}>
              <IconDownload className="mr-1.5 h-4 w-4" aria-hidden /> Download
            </LoadingButton>
            {data.canEdit || data.canDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-10 w-10 p-0" aria-label="More actions">
                    <IconDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {data.canEdit ? (
                    <>
                      <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                        <IconPencil className="mr-2 h-4 w-4" aria-hidden /> Edit details
                      </DropdownMenuItem>
                      {!archived ? (
                        <DropdownMenuItem onSelect={() => setReplaceOpen(true)}>
                          <IconReplace className="mr-2 h-4 w-4" aria-hidden /> Replace file
                        </DropdownMenuItem>
                      ) : null}
                      {archived ? (
                        <DropdownMenuItem
                          onSelect={async () => {
                            try {
                              await archive.mutateAsync({ id, archive: false });
                              toast.success('Restored to the library');
                            } catch (err) {
                              toast.error(errorMessage(err, 'Restore failed'));
                            }
                          }}
                        >
                          <IconRestore className="mr-2 h-4 w-4" aria-hidden /> Restore
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                          <IconArchive className="mr-2 h-4 w-4" aria-hidden /> Archive
                        </DropdownMenuItem>
                      )}
                    </>
                  ) : null}
                  {data.canDelete ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setDeleteOpen(true)}
                      >
                        <IconTrash className="mr-2 h-4 w-4" aria-hidden /> Delete permanently
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      />

      {archived ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          <IconArchive className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">
            Archived {formatDate(data.archivedAt)} — hidden from the library. Only the uploader and library curators can
            see it.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="min-w-0 overflow-hidden border-border shadow-aca">
          <LibraryViewer item={data} onDownload={() => void handleDownload()} downloading={downloading} />
        </Card>

        <aside className="min-w-0 space-y-4">
          <Card className="border-border p-5 shadow-aca">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/50 ring-1 ring-inset ring-black/5 dark:ring-white/10">
                <FileTypeIcon fileName={data.fileName ?? 'document'} mimeType={data.mimeType} size={26} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground" title={data.fileName ?? undefined}>
                  {data.fileName ?? 'No file'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {fileTypeLabel(data.fileType, data.fileName)} · {formatBytes(data.sizeBytes)}
                </p>
              </div>
            </div>

            {data.description ? (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{data.description}</p>
            ) : null}

            <dl className="mt-4 divide-y divide-border border-t border-border">
              <DetailRow label="Category">
                <Link href={`/library?category=${data.category.id}`} className="hover:text-primary hover:underline">
                  {data.category.name}
                </Link>
              </DetailRow>
              {data.authors ? <DetailRow label="Author(s)">{data.authors}</DetailRow> : null}
              {data.publishedYear ? <DetailRow label="Year">{data.publishedYear}</DetailRow> : null}
              {data.source ? (
                <DetailRow label="Source">
                  {/^https?:\/\//i.test(data.source) ? (
                    <a
                      href={data.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {data.source}
                    </a>
                  ) : (
                    data.source
                  )}
                </DetailRow>
              ) : null}
              <DetailRow label="Access">
                {data.visibility === 'Firm' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <IconWorld className="h-4 w-4 text-muted-foreground" aria-hidden /> Everyone in the firm
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-1">
                    <IconLock className="h-4 w-4 text-amber-600" aria-hidden />
                    {data.departments.map((d) => (
                      <Badge key={d.id} variant="warning">
                        {d.name}
                      </Badge>
                    ))}
                  </span>
                )}
              </DetailRow>
              <DetailRow label="Uploaded by">
                {data.uploadedBy.name}
                <span className="block text-xs text-muted-foreground">{formatDate(data.publishedAt ?? data.createdAt)}</span>
              </DetailRow>
              <DetailRow label="Activity">
                <span className="inline-flex items-center gap-3 tabular-nums text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <IconEye className="h-4 w-4" aria-hidden /> {data.viewCount} views
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <IconDownload className="h-4 w-4" aria-hidden /> {data.downloadCount}
                  </span>
                </span>
              </DetailRow>
            </dl>

            {data.tags.length ? (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                {data.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/library?tag=${encodeURIComponent(tag)}`}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            ) : null}
          </Card>

          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/library">
              <IconArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back to the library
            </Link>
          </Button>
        </aside>
      </div>

      <EditLibraryItemDialog item={data} open={editOpen} onOpenChange={setEditOpen} />
      <ReplaceLibraryFileDialog item={data} open={replaceOpen} onOpenChange={setReplaceOpen} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this item?"
        description="It will be hidden from the library. You can restore it later from Archived."
        confirmLabel="Archive"
        confirming={archive.isPending}
        onConfirm={async () => {
          try {
            await archive.mutateAsync({ id, archive: true });
            toast.success('Archived');
            setArchiveOpen(false);
          } catch (err) {
            toast.error(errorMessage(err, 'Archive failed'));
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete permanently?"
        description={`“${data.title}” and its file will be removed for everyone. This can't be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        confirming={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(id);
            toast.success('Deleted');
            setDeleteOpen(false);
            router.replace('/library?scope=archived');
          } catch (err) {
            toast.error(errorMessage(err, 'Delete failed'));
          }
        }}
      />
    </div>
  );
}
