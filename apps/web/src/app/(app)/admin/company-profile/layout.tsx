'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function CompanyProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="company-profile:view">{children}</RequirePermission>
  );
}
