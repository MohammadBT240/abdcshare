'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/data/empty-state';
import {
  useCreateHelpCategory,
  useDeleteHelpArticle,
  useHelpArticlesAdmin,
  useHelpCategoriesAdmin,
  usePublishHelpArticle,
  useUnpublishHelpArticle,
} from '../hooks/use-help-admin';

export function HelpAdminPage() {
  const categories = useHelpCategoriesAdmin();
  const articles = useHelpArticlesAdmin({});
  const createCategory = useCreateHelpCategory();
  const deleteArticle = useDeleteHelpArticle();
  const publish = usePublishHelpArticle();
  const unpublish = useUnpublishHelpArticle();

  const [newCategoryName, setNewCategoryName] = useState('');

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Help Center content</h1>
        <Link href="/admin/help/articles/new">
          <Button type="button">New article</Button>
        </Link>
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
                { onSuccess: () => setNewCategoryName('') },
              );
            }}
          >
            Add category
          </Button>
        </div>
        {categories.data && categories.data.length > 0 ? (
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
                    <TableCell className="font-medium text-foreground">{a.title}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{categoryName(a.categoryId)}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'published' ? 'default' : 'secondary'}>{a.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/help/articles/${a.id}/edit`}>
                          <Button type="button" size="sm" variant="outline">
                            Edit
                          </Button>
                        </Link>
                        {a.status === 'published' ? (
                          <Button type="button" size="sm" variant="ghost" onClick={() => unpublish.mutate(a.id)}>
                            Unpublish
                          </Button>
                        ) : (
                          <Button type="button" size="sm" variant="ghost" onClick={() => publish.mutate(a.id)}>
                            Publish
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteArticle.mutate(a.id)}
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
      </section>
    </div>
  );
}
