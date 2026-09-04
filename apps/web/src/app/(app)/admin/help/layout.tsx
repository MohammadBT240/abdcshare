'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function HelpAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="help:manage">{children}</RequirePermission>;
}
