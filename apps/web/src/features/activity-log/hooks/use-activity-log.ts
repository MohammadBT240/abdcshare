'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type { ActivityLogListResponse } from '../types';

export function useActivityLogList(queryString: string) {
  return useQuery({
    queryKey: ['audit', 'list', queryString],
    queryFn: () => bffApi<ActivityLogListResponse>(`/api/audit?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

/** Download CSV via BFF proxy (cookie auth). */
export async function downloadActivityLogCsv(queryString: string, filename = 'activity-log.csv') {
  const qs = queryString
    .split('&')
    .filter((part) => {
      const key = part.split('=')[0];
      return key !== 'page' && key !== 'pageSize' && key !== 'sort';
    })
    .join('&');
  const path = qs ? `audit/export?${qs}` : 'audit/export';
  const res = await fetch(`/api/bff/proxy/${path}`, { method: 'GET' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (typeof body.message === 'string' && body.message) || 'Export failed',
    );
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
