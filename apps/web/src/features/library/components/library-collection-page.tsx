'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconArchive,
  IconArrowDown,
  IconArrowLeft,
  IconArrowUp,
  IconCalendar,
  IconDots,
  IconExternalLink,
  IconFileZip,
  IconLock,
  IconMapPin,
  IconPencil,
  IconPlaylistAdd,
  IconRestore,
  IconTrash,
  IconUserShare,
  IconUpload,
  IconUser,
  IconWorld,
  IconX,
} from '@tabler/icons-react';
import { PageToolbar } from '@/components/layout/page-toolbar';
import { FileTypeIcon } from '@/components/data/file-type-icon';
import { ConfirmDialog, LoadingButton } from '@/components/forms';
import { useAuthContext } from '@/components/providers/auth-provider';
import { TransferOwnerDialog } from '@/features/library/components/transfer-owner-dialog';
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
  useCollectionItems,
  useCollectionMutations,
  useLibraryCollection,
} from '@/features/library/hooks/use-library-collections';
import { CollectionFormDialog } from '@/features/library/components/collection-form-dialog';
import { BulkUploadDialog } from '@/features/library/components/bulk-upload-dialog';
import { AddItemsDialog } from '@/features/library/components/add-items-dialog';
import { collectionTypeMeta, formatDateRange } from '@/features/library/lib/collection-types';
import { fileTypeLabel } from '@/features/library/lib/library-files';
import type { LibraryCollectionMember } from '@/features/library/types';

function errorMessage(err: unknown, fallback: string) {
  return err instanceof BffClientError ? err.message : fallback;
}

function groupBySection(members: LibraryCollectionMember[]) {
  const groups: { section: string | null; members: LibraryCollectionMember[] }[] = [];
  for (const m of members) {
    const last = groups[groups.length - 1];
    if (last && last.section === m.section) last.members.push(m);
    else groups.push({ section: m.section, members: [m] });
  }
  return groups;
}

export function LibraryCollectionPage({ id }: { id: string }) {
  const router = useRouter();
  const { can } = useAuthContext();
  const collection = useLibraryCollection(id);
  const members = useCollectionItems(id);
  const m = useCollectionMutations();
  const [editOpen, setEditOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const list = useMemo(() => members.data?.data ?? [], [members.data]);
  const memberIds = useMemo(() => new Set(list.map((x) => x.item.id)), [list]);

  if (collection.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (collection.isError || !collection.data) {
    const notFound = collection.error instanceof BffClientError && collection.error.statusCode === 404;
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm font-medium text-foreground">
          {notFound ? "This collection doesn't exist or you don't have access to it." : 'The collection could not be loaded.'}
        </p>
        <Button asChild variant="outline">
          <Link href="/library?tab=collections">
            <IconArrowLeft className="mr-1.5 h-4 w-4" aria-hidden /> Back to collections
          </Link>
        </Button>
      </div>
    );
  }

  const c = collection.data;
  const meta = collectionTypeMeta(c.type);
  const TypeIcon = meta.icon;
  const dates = formatDateRange(c.startsOn, c.endsOn);
  const archived = c.status === 'Archived';
  const canEdit = c.canEdit && !archived;

  async function move(index: number, delta: -1 | 1) {
    const next = [...list];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    // Moving across a section boundary adopts the neighbour's section.
    const moved = { ...next[index]!, section: next[target]!.section };
    next.splice(index, 1);
    next.splice(target, 0, moved);
    try {
      await m.reorder.mutateAsync({ id, items: next.map((x) => ({ itemId: x.item.id, section: x.section })) });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reorder'));
    }
  }

  async function exportZip() {
    try {
      const res = await m.exportZip.mutateAsync(id);
      toast.success(`Preparing a ZIP of ${res.files} file${res.files === 1 ? '' : 's'}`, {
        description: "You'll get a notification with the download link when it's ready.",
      });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not start the download'));
    }
  }

  let index = -1;

  return (
    <div>
      <PageToolbar
        title={c.title}
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Library', href: '/library' },
          { label: 'Collections', href: '/library?tab=collections' },
        ]}
        actions={
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {canEdit && can('library:contribute') ? (
              <Button type="button" onClick={() => setUploadOpen(true)}>
                <IconUpload className="mr-1.5 h-4 w-4" aria-hidden /> Upload files
              </Button>
            ) : null}
            <LoadingButton type="button" variant="outline" loading={m.exportZip.isPending} disabled={!c.itemCount} onClick={() => void exportZip()}>
              <IconFileZip className="mr-1.5 h-4 w-4" aria-hidden /> Download all
            </LoadingButton>
            {c.canEdit ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-10 w-10 p-0" aria-label="More actions">
                    <IconDots className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  {!archived ? (
                    <>
                      <DropdownMenuItem onSelect={() => setAddOpen(true)}>
                        <IconPlaylistAdd className="mr-2 h-4 w-4" aria-hidden /> Add existing items
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                        <IconPencil className="mr-2 h-4 w-4" aria-hidden /> Edit details
                      </DropdownMenuItem>
                      {can('library:curate') ? (
                        <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                          <IconUserShare className="mr-2 h-4 w-4" aria-hidden /> Transfer ownership
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem onSelect={() => setArchiveOpen(true)}>
                        <IconArchive className="mr-2 h-4 w-4" aria-hidden /> Archive
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem
                        onSelect={async () => {
                          try {
                            await m.archive.mutateAsync({ id, archive: false });
                            toast.success('Collection restored');
                          } catch (err) {
                            toast.error(errorMessage(err, 'Restore failed'));
                          }
                        }}
                      >
                        <IconRestore className="mr-2 h-4 w-4" aria-hidden /> Restore
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
                        <IconTrash className="mr-2 h-4 w-4" aria-hidden /> Delete collection
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        }
      />

      {archived ? (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <IconArchive className="h-4 w-4" aria-hidden /> This collection is archived. Its items are still in the library.
        </div>
      ) : null}

      <Card className="mb-6 border-border p-5 shadow-aca">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <TypeIcon className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <Badge variant="default">{meta.label}</Badge>
              {dates ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconCalendar className="h-4 w-4" aria-hidden /> {dates}
                </span>
              ) : null}
              {c.facilitator ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconUser className="h-4 w-4" aria-hidden /> {c.facilitator}
                </span>
              ) : null}
              {c.venue ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconMapPin className="h-4 w-4" aria-hidden /> {c.venue}
                </span>
              ) : null}
              {c.visibility === 'Firm' ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconWorld className="h-4 w-4" aria-hidden /> Everyone in the firm
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <IconLock className="h-4 w-4" aria-hidden /> {c.departments.map((d) => d.name).join(', ')}
                </span>
              )}
            </div>
            {c.description ? <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{c.description}</p> : null}
            {c.externalUrl ? (
              <a href={c.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <IconExternalLink className="h-4 w-4" aria-hidden /> {new URL(c.externalUrl).host}
              </a>
            ) : null}
            <p className="text-xs text-muted-foreground">Curated by {c.owner.name}</p>
          </div>
        </div>
      </Card>

      <section aria-labelledby="collection-items-heading">
        <div className="mb-3 flex items-center gap-2">
          <h2 id="collection-items-heading" className="text-sm font-semibold text-foreground">
            Items <span className="font-normal text-muted-foreground">· {c.itemCount}</span>
          </h2>
          {c.hiddenItemCount > 0 ? (
            <span className="text-xs text-muted-foreground">
              · {c.hiddenItemCount} more item{c.hiddenItemCount === 1 ? '' : 's'} you don't have access to
            </span>
          ) : null}
        </div>

        {members.isPending ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">Nothing in this collection yet</p>
            {canEdit ? (
              <div className="mt-4 flex gap-2">
                <Button type="button" size="sm" onClick={() => setUploadOpen(true)}>
                  <IconUpload className="mr-1.5 h-4 w-4" aria-hidden /> Upload files
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>
                  <IconPlaylistAdd className="mr-1.5 h-4 w-4" aria-hidden /> Add existing items
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            {groupBySection(list).map((g, gi) => (
              <div key={`${g.section ?? 'none'}-${gi}`}>
                {g.section ? (
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.section}</h3>
                ) : null}
                <Card className="divide-y divide-border overflow-hidden border-border shadow-aca">
                  {g.members.map((member) => {
                    index += 1;
                    const i = index;
                    const item = member.item;
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                        <FileTypeIcon fileName={item.fileName ?? 'document'} mimeType={item.mimeType} size={26} />
                        <div className="min-w-0 flex-1">
                          <Link href={`/library/${item.id}`} className="line-clamp-1 font-medium text-foreground hover:text-primary">
                            {item.title}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {[fileTypeLabel(item.fileType, item.fileName), item.authors, item.publishedYear].filter(Boolean).join(' · ')}
                            {item.visibility === 'Departments' ? ` · ${item.departments.map((d) => d.name).join(', ')} only` : ''}
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="flex shrink-0 items-center gap-0.5">
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Move ${item.title} up`} disabled={i === 0 || m.reorder.isPending} onClick={() => void move(i, -1)}>
                              <IconArrowUp className="h-4 w-4" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={`Move ${item.title} down`} disabled={i === list.length - 1 || m.reorder.isPending} onClick={() => void move(i, 1)}>
                              <IconArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${item.title} from the collection`}
                              onClick={async () => {
                                try {
                                  await m.removeItem.mutateAsync({ id, itemId: item.id });
                                  toast.success('Removed from the collection');
                                } catch (err) {
                                  toast.error(errorMessage(err, 'Could not remove'));
                                }
                              }}
                            >
                              <IconX className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))}
          </div>
        )}
      </section>

      <CollectionFormDialog open={editOpen} onOpenChange={setEditOpen} collection={c} />
      <BulkUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} collection={c} />
      <AddItemsDialog collection={c} memberIds={memberIds} open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this collection?"
        description="It will be hidden from the library. Its items are not affected."
        confirmLabel="Archive"
        confirming={m.archive.isPending}
        onConfirm={async () => {
          try {
            await m.archive.mutateAsync({ id, archive: true });
            toast.success('Collection archived');
            setArchiveOpen(false);
          } catch (err) {
            toast.error(errorMessage(err, 'Archive failed'));
          }
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this collection?"
        description={`“${c.title}” will be removed. The items in it stay in the library.`}
        confirmLabel="Delete"
        variant="destructive"
        confirming={m.remove.isPending}
        onConfirm={async () => {
          try {
            await m.remove.mutateAsync(id);
            toast.success('Collection deleted');
            setDeleteOpen(false);
            router.replace('/library?tab=collections&scope=archived');
          } catch (err) {
            toast.error(errorMessage(err, 'Delete failed'));
          }
        }}
      />
      <TransferOwnerDialog
        target={{ kind: 'collection', id: c.id, title: c.title, ownerId: c.owner.id, ownerName: c.owner.name }}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />
    </div>
  );
}
