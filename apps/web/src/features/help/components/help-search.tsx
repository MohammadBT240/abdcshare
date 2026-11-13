'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { IconLoader2, IconSearch, IconX } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useHelpSearch } from '../hooks/use-help';
import { snippetParts } from '../lib/doc-outline';
import type { HelpSearchResult } from '../types';

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Snippet({ text }: { text: string }) {
  return (
    <>
      {snippetParts(text).map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/30">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

function ResultItem({ r, active, onPick }: { r: HelpSearchResult; active: boolean; onPick?: () => void }) {
  return (
    <Link
      href={`/help/${r.slug}`}
      onClick={onPick}
      data-active={active || undefined}
      className="block rounded-lg px-3 py-2.5 hover:bg-muted data-[active]:bg-muted"
    >
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium text-foreground">{r.title}</span>
        <span className="text-xs text-muted-foreground">{r.category}</span>
      </span>
      {r.snippet ? (
        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
          …<Snippet text={r.snippet} />…
        </span>
      ) : r.summary ? (
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{r.summary}</span>
      ) : null}
    </Link>
  );
}

/**
 * Help search. `hero` = the big box on the landing page with results listed below it;
 * `compact` = the sidebar box with a dropdown. ↑/↓ + Enter work in both.
 */
export function HelpSearch({ variant = 'compact', autoFocus }: { variant?: 'hero' | 'compact'; autoFocus?: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query, 200);
  const search = useHelpSearch(debounced);
  const boxRef = useRef<HTMLDivElement>(null);
  const searching = debounced.trim().length > 1;
  const results = searching ? (search.data ?? []) : [];

  useEffect(() => setActive(0), [debounced]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = () => {
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      router.push(`/help/${results[active]!.slug}`);
      pick();
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const hero = variant === 'hero';
  const showList = hero ? searching : open && searching;

  const list = (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      className={cn(
        hero
          ? 'mt-3 rounded-xl border border-border bg-card p-1.5 text-left shadow-aca'
          : 'absolute left-0 right-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-aca',
      )}
      data-testid="help-search-results"
    >
      {search.isPending && results.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
      ) : results.length === 0 ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">
          No articles match “{debounced.trim()}”. Try a different word, or browse the topics below.
        </p>
      ) : (
        results.map((r, i) => <ResultItem key={r.id} r={r} active={i === active} onPick={pick} />)
      )}
    </div>
  );

  return (
    <div ref={boxRef} className={cn('relative', hero && 'mx-auto w-full max-w-2xl')}>
      <div className="relative">
        <IconSearch
          className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground', hero ? 'h-5 w-5' : 'h-4 w-4')}
          aria-hidden
        />
        <input
          type="search"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={hero ? 'Search help — e.g. “upload a file”, “reset password”' : 'Search help…'}
          aria-label="Search help articles"
          aria-controls={listId}
          className={cn(
            'w-full rounded-lg border border-input bg-card text-foreground outline-none ring-ring/40 placeholder:text-muted-foreground focus:ring-2 [&::-webkit-search-cancel-button]:hidden',
            hero ? 'h-12 pl-10 pr-10 text-base shadow-aca' : 'h-9 pl-9 pr-8 text-sm',
          )}
        />
        {search.isFetching && searching ? (
          <IconLoader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        ) : query ? (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <IconX className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      {showList ? list : null}
    </div>
  );
}
