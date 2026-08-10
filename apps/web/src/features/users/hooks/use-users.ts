'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { bffApi } from '@/lib/bff/client';
import type {
  ClientOption,
  DepartmentRecord,
  LookupRecord,
  RoleRecord,
  UserListResponse,
  UserRecord,
} from '@/features/users/types';

export function useUsersList(queryString: string) {
  return useQuery({
    queryKey: ['users', 'list', queryString],
    queryFn: () => bffApi<UserListResponse>(`/api/users?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => bffApi<UserRecord>(`/api/users/${id}`),
    enabled: Boolean(id),
  });
}

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => bffApi<RoleRecord[]>('/api/roles'),
    staleTime: 60_000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['departments', 'options'],
    queryFn: async () => {
      const res = await bffApi<{ data: DepartmentRecord[] }>('/api/departments?page=1&pageSize=100');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useLookup(type: string) {
  return useQuery({
    queryKey: ['reference', type],
    queryFn: async () => {
      const res = await bffApi<{ data: LookupRecord[] } | LookupRecord[]>(
        `/api/reference/${type}?page=1&pageSize=100`,
      );
      return Array.isArray(res) ? res : res.data;
    },
    staleTime: 60_000,
  });
}

export function useClientOptions() {
  return useQuery({
    queryKey: ['clients', 'options'],
    queryFn: async () => {
      const res = await bffApi<{ data: ClientOption[] }>('/api/clients?page=1&pageSize=100');
      return res.data;
    },
    staleTime: 60_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<UserRecord>('/api/users', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      bffApi<UserRecord>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['users', id] }),
      ]);
    },
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bffApi<UserRecord>(`/api/users/${id}/deactivate`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      bffApi<UserRecord>(`/api/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: async (_data, id) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        qc.invalidateQueries({ queryKey: ['users', id] }),
      ]);
    },
  });
}

export function useAssignDesignation(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id?: string;
      designation: 'PrincipalPartner' | 'Partner' | null;
    }) => {
      const userId = input.id ?? id;
      if (!userId) throw new Error('User id is required');
      return bffApi<UserRecord>(`/api/users/${userId}/designation`, {
        method: 'PATCH',
        body: JSON.stringify({ designation: input.designation }),
      });
    },
    onSuccess: async (_data, variables) => {
      const userId = variables.id ?? id;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['users'] }),
        userId ? qc.invalidateQueries({ queryKey: ['users', userId] }) : Promise.resolve(),
      ]);
    },
  });
}
