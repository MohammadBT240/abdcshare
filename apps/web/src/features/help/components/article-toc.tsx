'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { OutlineItem } from '../lib/doc-outline';

/** "On this page" — highlights the section currently at the top of the viewport. */
export function ArticleToc({ outline, className }: { outline: OutlineItem[]; className?: string }) {
  const [current, setCurrent] = useState<string | null>(outline[0]?.id ?? null);

  // The current section is the last heading that has scrolled past the top bar (or the first one).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let id = outline[0]?.id ?? null;
      for (const o of outline) {
        const el = document.getElementById(o.id);
        if (el && el.getBoundingClientRect().top <= 180) id = o.id;
      }
      // At the very bottom, the last section wins even if its heading never reaches the top.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) id = outline[outline.length - 1]?.id ?? id;
      setCurrent(id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [outline]);

  if (outline.length < 2) return null;
  return (
    <nav aria-label="On this page" className={cn('text-sm', className)}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/80">On this page</p>
      <ul className="space-y-1 border-l border-border">
        {outline.map((o) => (
          <li key={o.id}>
            <a
              href={`#${o.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(o.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                history.replaceState(null, '', `#${o.id}`);
                setCurrent(o.id);
              }}
              className={cn(
                '-ml-px block border-l-2 py-0.5 text-[13px] leading-snug transition-colors',
                o.level === 3 ? 'pl-6' : 'pl-3',
                current === o.id
                  ? 'border-primary font-medium text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {o.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
