'use client';

import { RequirePermission } from '@/components/auth/require-permission';

export default function EngagementsLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="engagement:view">{children}</RequirePermission>
  );
}
