'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateHTML } from '@tiptap/core';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { HELP_TIPTAP_EXTENSIONS } from '../lib/tiptap-extensions';
import { withHeadingIds, type PMNode } from '../lib/doc-outline';

/**
 * Renders a help article (Tiptap JSON → HTML) with docs styling (`.help-prose`), heading anchors,
 * in-app navigation for internal links and click-to-zoom screenshots.
 */
export function ArticleBody({ bodyJson, className }: { bodyJson: Record<string, unknown>; className?: string }) {
  const router = useRouter();
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  // generateHTML rebuilds the whole ProseMirror schema on each call — only redo it when the document changes.
  const html = useMemo(() => {
    const { doc } = withHeadingIds(bodyJson as unknown as PMNode);
    return generateHTML(doc as never, HELP_TIPTAP_EXTENSIONS);
  }, [bodyJson]);

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const img = target.closest('img');
    if (img && img.getAttribute('src')) {
      setZoom({ src: img.getAttribute('src')!, alt: img.getAttribute('alt') ?? '' });
      return;
    }
    const a = target.closest('a');
    const href = a?.getAttribute('href');
    if (!a || !href || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (href.startsWith('#')) {
      e.preventDefault();
      document.getElementById(decodeURIComponent(href.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', href);
      return;
    }
    if (href.startsWith('/')) {
      e.preventDefault();
      router.push(href);
    }
  };

  return (
    <>
      <div
        className={cn('help-prose', className)}
        onClick={onClick}
        // Content comes from the help sync (repo Markdown, raw HTML dropped) or the in-app editor
        // (help:manage only); both go through Tiptap's schema, which drops unknown markup.
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <Dialog open={Boolean(zoom)} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,80rem)] overflow-auto p-2 sm:p-3">
          <DialogTitle className="sr-only">{zoom?.alt || 'Screenshot'}</DialogTitle>
          {zoom ? (
            // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL, not a static asset
            <img src={zoom.src} alt={zoom.alt} className="h-auto w-full rounded-md" />
          ) : null}
          {zoom?.alt ? <p className="px-1 pb-1 text-center text-xs text-muted-foreground">{zoom.alt}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
