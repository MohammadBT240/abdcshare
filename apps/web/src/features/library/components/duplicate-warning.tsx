'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconCopy, IconLoader2 } from '@tabler/icons-react';
import { fetchLibraryDuplicates, sha256Hex } from '@/features/library/hooks/use-library';
import type { LibraryDuplicate } from '@/features/library/types';

/** Hash a chosen file in the browser and look for the same file already in the library (D27). */
export function useDuplicateCheck(file: File | null | undefined) {
  const [state, setState] = useState<{ checking: boolean; matches: LibraryDuplicate[] }>({ checking: false, matches: [] });
  useEffect(() => {
    if (!file) {
      setState({ checking: false, matches: [] });
      return;
    }
    let cancelled = false;
    setState({ checking: true, matches: [] });
    sha256Hex(file)
      .then((hash) => fetchLibraryDuplicates(hash))
      .then((matches) => !cancelled && setState({ checking: false, matches }))
      // A failed check never blocks an upload.
      .catch(() => !cancelled && setState({ checking: false, matches: [] }));
    return () => {
      cancelled = true;
    };
  }, [file]);
  return state;
}

/** "Already in the library: …" — a warning, never a block: Upload anyway is just carrying on. */
export function DuplicateWarning({ checking, matches }: { checking: boolean; matches: LibraryDuplicate[] }) {
  if (checking) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        <IconLoader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking whether this file is already in the library…
      </p>
    );
  }
  if (!matches.length) return null;
  return (
    <div
      role="status"
      data-testid="duplicate-warning"
      className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <p className="flex items-center gap-2 font-medium">
        <IconCopy className="h-4 w-4" aria-hidden /> Already in the library
      </p>
      <ul className="mt-1 space-y-0.5 pl-6">
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={`/library/${m.id}`} target="_blank" className="underline-offset-2 hover:underline">
              {m.title}
            </Link>
            <span className="opacity-80">
              {' '}
              · {m.category} · {m.uploadedBy}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 pl-6 text-xs opacity-80">Open it instead, or carry on to upload anyway.</p>
    </div>
  );
}
