'use client';

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LibraryBrowsePage } from '@/features/library/components/library-browse-page';

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 w-full rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <LibraryBrowsePage />
    </Suspense>
  );
}
