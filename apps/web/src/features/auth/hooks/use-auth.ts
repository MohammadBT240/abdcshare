'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthUser } from '@abdcshare/api-client';
import { hasPermission, resolvePermissions, type Permission, type RoleName } from '@abdcshare/shared';
import { bffJson } from '@/lib/bff/client';

export const AUTH_ME_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<AuthUser> {
  return bffJson<AuthUser>('/api/bff/auth/me');
}

export function useAuth() {
  const query = useQuery({
    queryKey: AUTH_ME_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: 60_000,
  });

  const role = (query.data?.role ?? '') as RoleName;
  const designation = query.data?.partnerDesignation ?? null;
  const permissions = resolvePermissions(role, designation);

  const can = (permission: Permission): boolean =>
    hasPermission(role, permission, designation);

  return {
    user: query.data,
    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    permissions,
    can,
    refetch: query.refetch,
  };
}

export function useInvalidateAuth() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: AUTH_ME_KEY });
}
