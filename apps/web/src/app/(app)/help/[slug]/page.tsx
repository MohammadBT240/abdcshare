'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { ArticleBody } from '@/features/help/components/article-body';
import { useHelpArticle } from '@/features/help/hooks/use-help';
import { EmptyState } from '@/components/data/empty-state';

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = useHelpArticle(slug);

  if (article.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (article.isError || !article.data) {
    return <EmptyState message="This article isn't available." />;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/help"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" />
        Back to Help Center
      </Link>
      <h1 className="text-2xl font-semibold text-foreground">{article.data.title}</h1>
      <ArticleBody bodyJson={article.data.bodyJson} />
    </div>
  );
}
