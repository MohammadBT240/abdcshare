'use client';

import Link from 'next/link';
import { IconArchive, IconCalendar, IconFiles, IconLock } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { collectionTypeMeta, formatDateRange } from '@/features/library/lib/collection-types';
import type { LibraryCollection } from '@/features/library/types';

export function CollectionCard({ collection }: { collection: LibraryCollection }) {
  const meta = collectionTypeMeta(collection.type);
  const TypeIcon = meta.icon;
  const dates = formatDateRange(collection.startsOn, collection.endsOn);
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-xl border border-border/80 bg-card p-4 shadow-[var(--shadow-aca)] transition-all',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
        collection.status === 'Archived' && 'opacity-75',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <TypeIcon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">{meta.label}</p>
          <h3 className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground">
            <Link
              href={`/library/collections/${collection.id}`}
              className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
            >
              {collection.title}
            </Link>
          </h3>
          {collection.facilitator ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{collection.facilitator}</p>
          ) : null}
        </div>
      </div>
      {collection.description ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{collection.description}</p>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <IconFiles className="h-3.5 w-3.5" aria-hidden />
          {collection.itemCount} item{collection.itemCount === 1 ? '' : 's'}
        </span>
        {dates ? (
          <span className="inline-flex items-center gap-1">
            <IconCalendar className="h-3.5 w-3.5" aria-hidden />
            {dates}
          </span>
        ) : null}
        {collection.visibility === 'Departments' ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <IconLock className="h-3.5 w-3.5" aria-hidden />
            {collection.departments.map((d) => d.name).join(', ')}
          </span>
        ) : null}
        {collection.status === 'Archived' ? (
          <span className="inline-flex items-center gap-1">
            <IconArchive className="h-3.5 w-3.5" aria-hidden /> Archived
          </span>
        ) : null}
      </div>
    </article>
  );
}
