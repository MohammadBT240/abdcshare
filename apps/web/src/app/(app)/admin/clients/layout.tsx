'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function ClientsAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="client:view">{children}</RequirePermission>;
}
