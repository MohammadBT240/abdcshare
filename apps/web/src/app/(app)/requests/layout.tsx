'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="request:view">{children}</RequirePermission>;
}
