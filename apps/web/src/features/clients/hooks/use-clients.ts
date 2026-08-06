'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export interface ClientRecord {
  id: string;
  name: string;
  clientType?: string | null;
  clientTypeId?: number | null;
  companyName?: string | null;
  companyRegisteredAddress?: string | null;
  incorporationDate?: string | null;
  incorporationNo?: string | null;
  officialAddress?: string | null;
  residentialAddress?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  primaryContactName?: string | null;
  primaryContactFirstName?: string | null;
  primaryContactSurname?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  primaryContactId?: string | null;
  primaryContactAvatarUrl?: string | null;
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
    placeholderData: keepPreviousData,
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
    mutationFn: (id: string) =>
      bffApi<ClientRecord>(`/api/clients/${id}/deactivate`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useResetClientContactPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffApi<ClientRecord>(`/api/clients/${id}/reset-contact-password`, { method: 'POST' }),
    onSuccess: async (_data, id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['clients'] }),
        qc.invalidateQueries({ queryKey: ['clients', id] }),
      ]);
    },
  });
}

export interface ClientContactRecord {
  id: string;
  firstName: string;
  middleName?: string | null;
  surname: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  titleId?: number | null;
  isPrimary: boolean;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

export function useClientContacts(clientId: string) {
  return useQuery({
    queryKey: ['clients', clientId, 'contacts'],
    queryFn: () => bffApi<ClientContactRecord[]>(`/api/clients/${clientId}/contacts`),
    enabled: Boolean(clientId),
  });
}

function invalidateClientContacts(qc: ReturnType<typeof useQueryClient>, clientId: string) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ['clients'] }),
    qc.invalidateQueries({ queryKey: ['clients', clientId] }),
    qc.invalidateQueries({ queryKey: ['clients', clientId, 'contacts'] }),
  ]);
}

export function useAddClientContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      firstName: string;
      surname: string;
      email: string;
      phoneNumber?: string;
      middleName?: string;
      titleId?: number;
    }) =>
      bffApi<ClientContactRecord>(`/api/clients/${clientId}/contacts`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await invalidateClientContacts(qc, clientId);
    },
  });
}

export function useUpdateClientContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      ...body
    }: {
      userId: string;
      firstName?: string;
      surname?: string;
      email?: string;
      phoneNumber?: string | null;
      middleName?: string | null;
    }) =>
      bffApi<ClientContactRecord>(`/api/clients/${clientId}/contacts/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await invalidateClientContacts(qc, clientId);
    },
  });
}

export function useSetPrimaryClientContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<ClientContactRecord>(`/api/clients/${clientId}/contacts/${userId}/set-primary`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await invalidateClientContacts(qc, clientId);
    },
  });
}

export function useResetClientContactUserPassword(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<ClientContactRecord>(`/api/clients/${clientId}/contacts/${userId}/reset-password`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await invalidateClientContacts(qc, clientId);
    },
  });
}

export function useDeactivateClientContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<ClientContactRecord>(`/api/clients/${clientId}/contacts/${userId}/deactivate`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      await invalidateClientContacts(qc, clientId);
    },
  });
}
