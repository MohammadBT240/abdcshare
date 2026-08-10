'use client';

import { useQuery } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { DashboardSummary } from '../types';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => bffApi<DashboardSummary>('/api/dashboard'),
    staleTime: 30_000,
  });
}
