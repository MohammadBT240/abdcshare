'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="library:view">{children}</RequirePermission>;
}
