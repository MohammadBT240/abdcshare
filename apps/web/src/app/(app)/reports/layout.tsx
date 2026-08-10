'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="partner-report:view">{children}</RequirePermission>;
}
