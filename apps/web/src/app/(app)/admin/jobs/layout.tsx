'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function JobsAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="system:jobs">{children}</RequirePermission>;
}
