'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function UsersAdminLayout({ children }: { children: React.ReactNode }) {
  return <RequirePermission permission="user:view">{children}</RequirePermission>;
}
