'use client';

import Link from 'next/link';
import { IconThumbDown, IconThumbUp } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/data/empty-state';
import { useHelpFeedbackStats } from '../hooks/use-help-admin';

function when(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

/** "Was this helpful?" answers per article, least helpful first, with readers' notes. */
export function HelpFeedbackPanel() {
  const stats = useHelpFeedbackStats();
  if (stats.isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (stats.isError) return <ErrorState message="Failed to load feedback" />;
  if (!stats.data.length) return <EmptyState message="No feedback yet. Readers answer “Was this article helpful?” at the end of each article." />;

  return (
    <ul className="space-y-3" data-testid="help-feedback-stats">
      {stats.data.map((s) => (
        <li key={s.articleId} className="rounded-xl border border-border bg-card p-4 shadow-aca">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/help/${s.slug}`} className="font-medium text-foreground hover:text-primary hover:underline">
              {s.title}
            </Link>
            <span className="flex items-center gap-3 text-sm">
              <span className="inline-flex items-center gap-1 text-primary" title="Helpful">
                <IconThumbUp className="h-4 w-4" aria-hidden /> {s.helpful}
              </span>
              <span className="inline-flex items-center gap-1 text-destructive" title="Not helpful">
                <IconThumbDown className="h-4 w-4" aria-hidden /> {s.notHelpful}
              </span>
              <span className="text-xs text-muted-foreground">Last {when(s.lastAt)}</span>
            </span>
          </div>
          {s.comments.length ? (
            <ul className="mt-3 space-y-2 border-t border-border pt-3">
              {s.comments.map((c, i) => (
                <li key={i} className="text-sm">
                  <span className="text-foreground">“{c.comment}”</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.by} · {when(c.at)} · {c.helpful ? 'helpful' : 'not helpful'}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
