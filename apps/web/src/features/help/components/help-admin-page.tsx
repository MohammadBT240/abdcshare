'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { BffClientError } from '@/lib/bff/client';
import type { HelpArticleSummary } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, ErrorState } from '@/components/data/empty-state';
import { ConfirmDialog } from '@/components/forms/confirm-dialog';
import {
  useCreateHelpCategory,
  useDeleteHelpArticle,
  useHelpArticlesAdmin,
  useHelpCategoriesAdmin,
  usePublishHelpArticle,
  useRestoreHelpDefault,
  useSyncHelpDefaults,
  useUnpublishHelpArticle,
} from '../hooks/use-help-admin';

export function HelpAdminPage() {
  const categories = useHelpCategoriesAdmin();
  const articles = useHelpArticlesAdmin({});
  const createCategory = useCreateHelpCategory();
  const deleteArticle = useDeleteHelpArticle();
  const publish = usePublishHelpArticle();
  const unpublish = useUnpublishHelpArticle();
  const restore = useRestoreHelpDefault();
  const syncDefaults = useSyncHelpDefaults();
  const [restoreTarget, setRestoreTarget] = useState<HelpArticleSummary | null>(null);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<HelpArticleSummary | null>(null);

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '—';

  const notifyFailure = (fallback: string) => (err: unknown) =>
    toast.error(err instanceof BffClientError ? err.message : fallback);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Help Center content</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            <strong>Built-in</strong> articles ship with the app and update with it. If you edit one, your version is kept
            and marked <strong>Edited</strong> — use Restore default to go back to the shipped text.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={syncDefaults.isPending}
            onClick={() =>
              syncDefaults.mutate(undefined, {
                onSuccess: (r) =>
                  r.skipped === 'locked'
                    ? toast.message('An update is already running — try again in a moment')
                    : toast.success(
                        `Built-in articles checked: ${r.created.length} added, ${r.updated.length} updated` +
                          (r.keptEdited.length ? `, ${r.keptEdited.length} kept (edited here)` : ''),
                      ),
                onError: notifyFailure('Failed to update built-in articles'),
              })
            }
          >
            Update built-in articles
          </Button>
          <Button type="button" asChild>
            <Link href="/admin/help/articles/new">New article</Link>
          </Button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Categories</h2>
        <div className="flex gap-2">
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name"
          />
          <Button
            type="button"
            variant="outline"
            disabled={!newCategoryName.trim() || createCategory.isPending}
            onClick={() => {
              const slug = newCategoryName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
              createCategory.mutate(
                { name: newCategoryName.trim(), slug },
                {
                  onSuccess: () => setNewCategoryName(''),
                  onError: notifyFailure('Failed to create category'),
                },
              );
            }}
          >
            Add category
          </Button>
        </div>
        {categories.isPending ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-20 rounded-full" />
            ))}
          </div>
        ) : categories.isError ? (
          <ErrorState message="Failed to load categories" />
        ) : categories.data && categories.data.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <li key={c.id}>
                <Badge variant="secondary">{c.name}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No categories yet" />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Articles</h2>
        {articles.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : articles.isError ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ErrorState message="Failed to load articles" />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-aca">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(articles.data?.data ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No articles yet
                    </TableCell>
                  </TableRow>
                ) : (
                  articles.data!.data.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-foreground">
                        <Link href={`/help/${a.slug}`} className="hover:text-primary hover:underline">
                          {a.title}
                        </Link>
                        <span className="ml-2 inline-flex gap-1 align-middle">
                          {a.source === 'default' ? <Badge variant="outline">Built-in</Badge> : null}
                          {a.edited ? <Badge variant="secondary">Edited</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{categoryName(a.categoryId)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="outline" asChild>
                            <Link href={`/admin/help/articles/${a.id}/edit`}>Edit</Link>
                          </Button>
                          {a.status === 'published' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                unpublish.mutate(a.id, {
                                  onSuccess: () => toast.success('Article unpublished'),
                                  onError: notifyFailure('Failed to unpublish article'),
                                })
                              }
                            >
                              Unpublish
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                publish.mutate(a.id, {
                                  onSuccess: () => toast.success('Article published'),
                                  onError: notifyFailure('Failed to publish article'),
                                })
                              }
                            >
                              Publish
                            </Button>
                          )}
                          {a.edited ? (
                            <Button type="button" size="sm" variant="ghost" onClick={() => setRestoreTarget(a)}>
                              Restore default
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteTarget(a)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        title="Restore the built-in version?"
        description={`Your changes to "${restoreTarget?.title ?? 'this article'}" will be replaced by the version that ships with the app.`}
        confirmLabel="Restore default"
        confirming={restore.isPending}
        onConfirm={() => {
          if (!restoreTarget) return;
          restore.mutate(restoreTarget.id, {
            onSuccess: () => {
              setRestoreTarget(null);
              toast.success('Built-in version restored');
            },
            onError: notifyFailure('Failed to restore the article'),
          });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete article?"
        description={`"${deleteTarget?.title ?? 'This article'}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        confirming={deleteArticle.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteArticle.mutate(deleteTarget.id, {
            onSuccess: () => {
              setDeleteTarget(null);
              toast.success('Article deleted');
            },
            onError: notifyFailure('Failed to delete article'),
          });
        }}
      />
    </div>
  );
}
