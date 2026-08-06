'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function FinalReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="report-review:respond">{children}</RequirePermission>
  );
}
