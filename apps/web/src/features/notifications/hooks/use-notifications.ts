'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NotificationList, UnreadCount } from '@abdcshare/api-client';
import { bffJson } from '@/lib/bff/client';

export const NOTIFICATIONS_UNREAD_KEY = ['notifications', 'unread-count'] as const;
export const NOTIFICATIONS_LIST_KEY = ['notifications', 'list'] as const;

export function useUnreadCount(enabled: boolean) {
  return useQuery({
    queryKey: NOTIFICATIONS_UNREAD_KEY,
    queryFn: () => bffJson<UnreadCount>('/api/bff/notifications/unread-count'),
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useNotificationList(enabled: boolean) {
  return useQuery({
    queryKey: NOTIFICATIONS_LIST_KEY,
    queryFn: () =>
      bffJson<NotificationList>('/api/bff/notifications?page=1&pageSize=10'),
    enabled,
    staleTime: 15_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffJson(`/api/bff/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY }),
        qc.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY }),
      ]);
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bffJson('/api/bff/notifications/read-all', { method: 'POST' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: NOTIFICATIONS_UNREAD_KEY }),
        qc.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_KEY }),
      ]);
    },
  });
}
