'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function FirmFinalReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequirePermission permission="report-review:manage">{children}</RequirePermission>
  );
}
