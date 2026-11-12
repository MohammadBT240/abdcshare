'use client';

import { RequirePermission } from '@/components/auth/require-permission';
import { LibraryReviewPage } from '@/features/library/components/library-review-page';

export default function LibraryReviewRoute() {
  return (
    <RequirePermission permission="library:curate">
      <LibraryReviewPage />
    </RequirePermission>
  );
}
