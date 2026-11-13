'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { IconExternalLink, IconHelpCircle } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ArticleBody } from './article-body';
import { useHelpArticle } from '../hooks/use-help';

/**
 * Contextual help: opens the article in a side sheet without leaving the page. `section` jumps to
 * a heading (its anchor id, e.g. `who-can-see-an-item`) and is carried over to "Open full article".
 */
export function HelpTip({ slug, section, label = 'Help' }: { slug: string; section?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Only fetch once the drawer is opened — a HelpTip on a page shouldn't cost a request on every render.
  const article = useHelpArticle(slug, { enabled: open });
  const loaded = article.isError ? undefined : article.data;
  const href = `/help/${slug}${section ? `#${section}` : ''}`;

  useEffect(() => {
    if (!open || !loaded || !section) return;
    const t = setTimeout(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`#${CSS.escape(section)}`);
      el?.scrollIntoView({ block: 'start' });
    }, 50);
    return () => clearTimeout(t);
  }, [open, loaded, section]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" data-testid="help-tip">
          <IconHelpCircle className="h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {/* Radix requires a title on every dialog, including the loading/error states. */}
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="pr-6">{loaded?.title ?? label}</SheetTitle>
          {loaded?.summary ? <SheetDescription>{loaded.summary}</SheetDescription> : <SheetDescription className="sr-only">Help</SheetDescription>}
        </SheetHeader>
        {article.isPending ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">Loading…</p>
        ) : !loaded ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">This article isn&apos;t available.</p>
        ) : (
          <>
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
              <ArticleBody bodyJson={loaded.bodyJson} />
            </div>
            <div className="border-t border-border px-5 py-3">
              <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Open full article <IconExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
