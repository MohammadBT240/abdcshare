'use client';

import { useParams } from 'next/navigation';
import { ArticleEditorPage } from '@/features/help/components/article-editor-page';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <ArticleEditorPage articleId={id} />;
}
