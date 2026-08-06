'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Permission } from '@abdcshare/shared';
import { useAuthContext } from '@/components/providers/auth-provider';

/**
 * Route gate aligned with sidebar permissions.
 * Redirects to dashboard when the user lacks the required permission.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const router = useRouter();
  const { can, isPending, user } = useAuthContext();
  const allowed = can(permission);

  useEffect(() => {
    if (isPending) return;
    if (!user || !allowed) {
      router.replace('/dashboard');
    }
  }, [isPending, user, allowed, router]);

  if (isPending || !user || !allowed) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
