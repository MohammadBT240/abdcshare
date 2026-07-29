'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export interface ClientRecord {
  id: string;
  name: string;
  clientType?: string | null;
  companyName?: string | null;
  incorporationNo?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ClientListResponse {
  data: ClientRecord[];
  meta: PageMeta;
}

export function useClientsList(queryString: string) {
  return useQuery({
    queryKey: ['clients', 'list', queryString],
    queryFn: () => bffApi<ClientListResponse>(`/api/clients?${queryString}`),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['clients', id],
    queryFn: () => bffApi<ClientRecord>(`/api/clients/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<ClientRecord>('/api/clients', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<ClientRecord>(`/api/clients/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['clients'] }),
        qc.invalidateQueries({ queryKey: ['clients', id] }),
      ]);
    },
  });
}

export function useDeactivateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<ClientRecord>(`/api/clients/${id}/deactivate`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
