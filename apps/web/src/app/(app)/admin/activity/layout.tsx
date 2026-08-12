'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function ActivityAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="audit:view">{children}</RequirePermission>;
}
