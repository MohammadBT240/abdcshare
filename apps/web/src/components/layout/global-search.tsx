'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  IconBooks,
  IconBriefcase,
  IconBuilding,
  IconFileText,
  IconInbox,
  IconSearch,
  type Icon,
} from '@tabler/icons-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { bffApi } from '@/lib/bff/client';

interface SearchHit {
  id: string;
  label: string;
  sublabel?: string | null;
  href?: string;
}
interface SearchResults {
  engagements: SearchHit[];
  requests: SearchHit[];
  documents: SearchHit[];
  clients: SearchHit[];
  library: SearchHit[];
}

const GROUPS: { key: keyof SearchResults; heading: string; icon: Icon }[] = [
  { key: 'engagements', heading: 'Engagements', icon: IconBriefcase },
  { key: 'requests', heading: 'Requests', icon: IconInbox },
  { key: 'documents', heading: 'Documents', icon: IconFileText },
  { key: 'library', heading: 'Library', icon: IconBooks },
  { key: 'clients', heading: 'Clients', icon: IconBuilding },
];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/**
 * Header search (⌘K / Ctrl+K) over `GET /api/search` — engagements, requests, documents,
 * clients and (S3) the library. The API applies each user's visibility; nothing is filtered here.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim(), 200);
  const results = useQuery({
    queryKey: ['global-search', term],
    queryFn: () => bffApi<SearchResults>(`/api/search?q=${encodeURIComponent(term)}`),
    enabled: open && term.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (href?: string) => {
    if (!href) return;
    setOpen(false);
    setQ('');
    router.push(href);
  };

  const data = term.length >= 2 ? results.data : undefined;
  const total = data ? GROUPS.reduce((n, g) => n + (data[g.key]?.length ?? 0), 0) : 0;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 rounded-full px-2.5 text-muted-foreground sm:w-56 sm:justify-start"
        aria-label="Search"
      >
        <IconSearch className="h-4 w-4" aria-hidden />
        <span className="hidden text-xs sm:inline">Search…</span>
        <kbd className="ml-auto hidden rounded border border-border bg-muted px-1.5 text-[10px] font-medium sm:inline">
          ⌘K
        </kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command shouldFilter={false} label="Search">
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder="Search engagements, requests, documents, the library…"
              autoFocus
            />
            <CommandList className="max-h-[60vh]">
              {term.length < 2 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Type at least two characters.</p>
              ) : results.isFetching && !data ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</p>
              ) : (
                <CommandEmpty>No results for “{term}”.</CommandEmpty>
              )}
              {data && total > 0
                ? GROUPS.map((g) =>
                    data[g.key]?.length ? (
                      <CommandGroup key={g.key} heading={g.heading}>
                        {data[g.key].map((hit) => (
                          <CommandItem
                            key={`${g.key}-${hit.id}`}
                            value={`${g.key}-${hit.id}`}
                            onSelect={() => go(hit.href)}
                            disabled={!hit.href}
                          >
                            <g.icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{hit.label}</span>
                            {hit.sublabel ? (
                              <span className="ml-2 max-w-[40%] truncate text-xs text-muted-foreground">{hit.sublabel}</span>
                            ) : null}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ) : null,
                  )
                : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
