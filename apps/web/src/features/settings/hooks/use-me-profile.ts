'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import { AUTH_ME_KEY } from '@/features/auth/hooks/use-auth';
import type { MeProfile } from '@/features/settings/types';

export const ME_PROFILE_KEY = ['users', 'me'] as const;

export function useMeProfile() {
  return useQuery({
    queryKey: ME_PROFILE_KEY,
    queryFn: () => bffApi<MeProfile>('/api/users/me'),
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<MeProfile>('/api/users/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ME_PROFILE_KEY }),
        qc.invalidateQueries({ queryKey: AUTH_ME_KEY }),
      ]);
    },
  });
}
