'use client';

import { RequirePermission } from '@/components/auth/require-permission';
import { CatalogueShell } from '@/features/catalogues/components/catalogue-shell';

export default function CataloguesLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequirePermission permission="catalogue:view">
      <CatalogueShell>{children}</CatalogueShell>
    </RequirePermission>
  );
}
