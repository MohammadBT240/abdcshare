'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="review:decide">{children}</RequirePermission>;
}
