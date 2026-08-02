'use client';

import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export interface RequestListItem {
  id: string;
  /** Display label — API has no request reference code yet; falls back to type name. */
  referenceCode: string;
  engagementId: string;
  engagementTitle: string;
  requestTypeId: number;
  requestTypeName: string;
  requestClassId: number;
  requestClassName: string;
  description?: string;
  phase: 'Planning' | 'Execution' | 'Reporting';
  stage: string;
  status: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  assignees: Array<{
    userId: string;
    fullName: string;
    avatarUrl?: string;
  }>;
  isOverdue: boolean;
}

export interface RequestListResponse {
  data: RequestListItem[];
  meta: PageMeta;
}

/** Raw Nest list/detail payload (stageName/statusName; list omits assignees). */
interface ApiRequestRow {
  id: string;
  engagementId: string;
  engagementTitle?: string | null;
  engagementReferenceCode?: string | null;
  referenceCode?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  requestTypeId: number;
  requestTypeName?: string | null;
  requestClassId: number;
  requestClassName?: string | null;
  description?: string | null;
  phase?: 'Planning' | 'Execution' | 'Reporting' | null;
  stage?: string | null;
  stageId?: number | null;
  stageName?: string | null;
  status?: string | null;
  statusId?: number | null;
  statusName?: string | null;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  assignees?: Array<{ userId: string; fullName: string; avatarUrl?: string }>;
  isOverdue?: boolean;
}

function isDoneStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes('complete') || s.includes('closed') || s.includes('done');
}

function computeIsOverdue(dueDate: string | undefined, status: string): boolean {
  if (!dueDate || isDoneStatus(status)) return false;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const endOfDue = new Date(due);
  endOfDue.setHours(23, 59, 59, 999);
  return endOfDue < new Date();
}

function normalizeRequestRow(row: ApiRequestRow): RequestListItem {
  const requestTypeName = row.requestTypeName ?? 'Request';
  const status = row.status ?? row.statusName ?? '';
  const dueDate = row.dueDate ?? undefined;
  return {
    id: row.id,
    referenceCode: row.referenceCode ?? requestTypeName,
    engagementId: row.engagementId,
    engagementTitle: row.engagementTitle ?? '',
    requestTypeId: row.requestTypeId,
    requestTypeName,
    requestClassId: row.requestClassId,
    requestClassName: row.requestClassName ?? '',
    description: row.description ?? undefined,
    phase: row.phase ?? 'Planning',
    stage: row.stage ?? row.stageName ?? '',
    status,
    dueDate,
    completedAt: row.completedAt ?? undefined,
    createdAt: row.createdAt,
    assignees: row.assignees ?? [],
    isOverdue: row.isOverdue ?? computeIsOverdue(dueDate, status),
  };
}

export interface RequestDetail extends RequestListItem {
  clientId: string;
  clientName: string;
  departmentId: number;
  departmentName: string;
  stageId?: number;
  statusId?: number;
}

export interface RequestHistoryItem {
  id: string;
  eventType: string;
  module: string;
  fromValue?: string | null;
  toValue?: string | null;
  note?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface RequestHistoryResponse {
  data: RequestHistoryItem[];
}

export function useRequestsList(queryString: string) {
  return useQuery({
    queryKey: ['requests', 'list', queryString],
    queryFn: async () => {
      const res = await bffApi<{ data: ApiRequestRow[]; meta: PageMeta }>(
        `/api/requests?${queryString}`,
      );
      return {
        data: res.data.map(normalizeRequestRow),
        meta: res.meta,
      } satisfies RequestListResponse;
    },
    placeholderData: keepPreviousData,
  });
}

export function useRequest(id: string) {
  return useQuery({
    queryKey: ['requests', id],
    queryFn: async () => {
      const row = await bffApi<ApiRequestRow & Partial<RequestDetail>>(`/api/requests/${id}`);
      return {
        ...normalizeRequestRow(row),
        clientId: row.clientId ?? '',
        clientName: row.clientName ?? '',
        departmentId: row.departmentId ?? 0,
        departmentName: row.departmentName ?? '',
        stageId: row.stageId ?? undefined,
        statusId: row.statusId ?? undefined,
      } satisfies RequestDetail;
    },
    enabled: Boolean(id),
  });
}

export function useRequestHistory(id: string, enabled = true) {
  return useQuery({
    queryKey: ['requests', id, 'history'],
    queryFn: async () => {
      const rows = await bffApi<RequestHistoryItem[] | RequestHistoryResponse>(
        `/api/requests/${id}/history`,
      );
      const data = Array.isArray(rows) ? rows : (rows.data ?? []);
      return { data } satisfies RequestHistoryResponse;
    },
    enabled: Boolean(id) && enabled,
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      engagementId: string;
      requestTypeId: number;
      description?: string;
      dueDate?: string;
      assigneeIds?: string[];
    }) => bffApi<RequestDetail>('/api/requests', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['requests'] });
      await qc.invalidateQueries({ queryKey: ['engagements'] });
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { description?: string; dueDate?: string }) =>
      bffApi<RequestDetail>(`/api/requests/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['requests', id] }),
        qc.invalidateQueries({ queryKey: ['engagements'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useDeleteRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bffApi<{ ok: true }>(`/api/requests/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['engagements'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useBulkUpdateRequests() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      ids: string[];
      stageId?: number;
      statusId?: number;
      assigneeUserId?: string;
    }) => bffApi<{ updated: number }>('/api/requests/bulk', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['engagements'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useTransitionRequestStage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { stageId: number; note?: string }) =>
      bffApi<void>(`/api/requests/${id}/stage`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['requests', id] }),
        qc.invalidateQueries({ queryKey: ['engagements'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useUpdateRequestStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { statusId: number; note?: string }) =>
      bffApi<void>(`/api/requests/${id}/status`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['requests', id] }),
        qc.invalidateQueries({ queryKey: ['engagements'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
    },
  });
}

export function useAddRequestAssignee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string }) =>
      bffApi<void>(`/api/requests/${id}/assignees`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['requests', id] }),
      ]);
    },
  });
}

export function useRemoveRequestAssignee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<void>(`/api/requests/${id}/assignees/${userId}`, { method: 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['requests', id] }),
      ]);
    },
  });
}
