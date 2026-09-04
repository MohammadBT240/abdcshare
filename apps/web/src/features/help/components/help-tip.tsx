'use client';

import { useState } from 'react';
import Link from 'next/link';
import { IconHelpCircle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ArticleBody } from './article-body';
import { useHelpArticle } from '../hooks/use-help';

export function HelpTip({ slug, label = 'Help' }: { slug: string; label?: string }) {
  const [open, setOpen] = useState(false);
  // Only fetch once the drawer is opened — a HelpTip on a page shouldn't cost a request
  // on every render of that page.
  const article = useHelpArticle(slug, { enabled: open });
  const loaded = article.isError ? undefined : article.data;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <IconHelpCircle className="h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        {/* Radix requires a title on every dialog, including the loading/error states. */}
        <SheetHeader>
          <SheetTitle>{loaded?.title ?? label}</SheetTitle>
        </SheetHeader>
        {article.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">This article isn&apos;t available.</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <ArticleBody bodyJson={loaded.bodyJson} />
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
