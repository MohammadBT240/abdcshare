'use client';

import { Suspense } from 'react';
import { RequirePermission } from '@/components/auth/require-permission';
import { LibraryReviewPage } from '@/features/library/components/library-review-page';

export default function LibraryReviewRoute() {
  return (
    <RequirePermission permission="library:curate">
      <Suspense>
        <LibraryReviewPage />
      </Suspense>
    </RequirePermission>
  );
}
