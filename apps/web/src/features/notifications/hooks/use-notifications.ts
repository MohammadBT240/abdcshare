'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import type { NotificationList, UnreadCount } from '@abdcshare/api-client';
import { bffJson, bffApi } from '@/lib/bff/client';

export const NOTIFICATIONS_UNREAD_KEY = ['notifications', 'unread-count'] as const;
export const NOTIFICATIONS_LIST_KEY = ['notifications', 'list'] as const;
export const NOTIFICATIONS_CATALOG_KEY = ['notifications', 'catalog'] as const;
export const NOTIFICATIONS_PREFS_KEY = ['notifications', 'preferences'] as const;

export interface NotificationTypeCatalogItem {
  type: string;
  label: string;
  description: string;
  category: string;
}

export interface NotificationPreference {
  notificationType: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
}

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

export function useNotificationCatalog() {
  return useQuery({
    queryKey: NOTIFICATIONS_CATALOG_KEY,
    queryFn: () => bffApi<NotificationTypeCatalogItem[]>('/api/notifications/catalog'),
    staleTime: 60_000,
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATIONS_PREFS_KEY,
    queryFn: () => bffApi<NotificationPreference[]>('/api/notifications/preferences'),
    placeholderData: keepPreviousData,
  });
}

export function useSetNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      type: string;
      emailEnabled?: boolean;
      inAppEnabled?: boolean;
    }) =>
      bffApi<NotificationPreference>(
        `/api/notifications/preferences/${encodeURIComponent(body.type)}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            emailEnabled: body.emailEnabled,
            inAppEnabled: body.inAppEnabled,
          }),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: NOTIFICATIONS_PREFS_KEY });
    },
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
