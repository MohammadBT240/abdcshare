'use client';

import Link from 'next/link';
import { IconHelpCircle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ArticleBody } from './article-body';
import { useHelpArticle } from '../hooks/use-help';

export function HelpTip({ slug, label = 'Help' }: { slug: string; label?: string }) {
  const article = useHelpArticle(slug);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <IconHelpCircle className="h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        {article.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : article.isError || !article.data ? (
          <p className="text-sm text-muted-foreground">This article isn&apos;t available.</p>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>{article.data.title}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <ArticleBody bodyJson={article.data.bodyJson} />
            </div>
            <Link href={`/help/${slug}`} className="text-sm font-medium text-primary hover:underline">
              View full article
            </Link>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
