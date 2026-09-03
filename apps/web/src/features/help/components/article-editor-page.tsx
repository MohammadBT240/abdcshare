'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArticleEditor, type ArticleFormValues } from './article-editor';
import { useHelpArticle } from '../hooks/use-help';
import {
  useCreateHelpArticle,
  useHelpCategoriesAdmin,
  useUpdateHelpArticle,
} from '../hooks/use-help-admin';
import { ErrorState } from '@/components/data/empty-state';

export function ArticleEditorPage({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug') ?? '';
  const categories = useHelpCategoriesAdmin();
  const existing = useHelpArticle(slug);
  const create = useCreateHelpArticle();
  const update = useUpdateHelpArticle(articleId ?? '');
  const [error, setError] = useState<string | null>(null);

  if (categories.isPending || (articleId && existing.isPending)) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  if (articleId && existing.isError) {
    return <ErrorState message="Failed to load article." />;
  }

  const handleSubmit = (values: ArticleFormValues) => {
    setError(null);
    if (articleId) {
      update.mutate(values, {
        onSuccess: () => router.push('/admin/help'),
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save article.'),
      });
    } else {
      create.mutate(values, {
        onSuccess: () => router.push('/admin/help'),
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save article.'),
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">
        {articleId ? 'Edit article' : 'New article'}
      </h1>
      <ArticleEditor
        categories={categories.data ?? []}
        initial={
          articleId && existing.data
            ? {
                title: existing.data.title,
                slug: existing.data.slug,
                categoryId: existing.data.categoryId,
                bodyJson: existing.data.bodyJson,
                visibleToRoles: existing.data.visibleToRoles,
              }
            : undefined
        }
        onSubmit={handleSubmit}
        submitting={create.isPending || update.isPending}
        error={error}
      />
    </div>
  );
}
