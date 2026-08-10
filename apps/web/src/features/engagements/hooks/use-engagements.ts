"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import type { PageMeta } from "@abdcshare/api-client";
import { bffApi } from "@/lib/bff/client";

export interface EngagementTeamPreview {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface EngagementListItem {
  id: string;
  referenceCode: string;
  clientId: string;
  clientName: string;
  engagementTypeId: number;
  engagementTypeName: string;
  departmentId: number;
  departmentName: string;
  title: string;
  periodLabel?: string;
  stage: "Planning" | "Execution" | "Reporting" | "Completed" | "Archived";
  startDate?: string;
  targetCompletionDate?: string;
  completedAt?: string;
  createdAt: string;
  requestCount: number;
  overdueCount: number;
  teamSize: number;
  teamPreview?: EngagementTeamPreview[];
  progressPercent?: number;
}

export interface EngagementListResponse {
  data: EngagementListItem[];
  meta: PageMeta;
}

export interface EngagementTeamMember {
  userId: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  memberRole: "Lead" | "Member";
  addedAt: string;
}

export interface EngagementClientContact {
  userId: string;
  fullName: string;
  email: string;
  isMain: boolean;
  receiveEmail: boolean;
  avatarUrl?: string | null;
}

export interface ClassRollup {
  requestClassId: number;
  name: string;
  total: number;
  done: number;
  overdue: number;
  progressPercent: number;
  signedOff: boolean;
  phaseCounts?: {
    Planning: number;
    Execution: number;
    Reporting: number;
  };
}

export interface SignOff {
  id: string;
  requestClassId?: number | null;
  requestClassName?: string | null;
  signedById: string;
  signedByName?: string | null;
  signedAt: string;
  note?: string | null;
  revoked: boolean;
  revokedAt?: string | null;
}

export interface EngagementWorkspace {
  id: string;
  referenceCode: string;
  clientId: string;
  clientName: string;
  engagementTypeId: number;
  engagementTypeName: string;
  departmentId: number;
  departmentName: string;
  title: string;
  periodLabel?: string;
  stage: "Planning" | "Execution" | "Reporting" | "Completed" | "Archived";
  startDate?: string;
  targetCompletionDate?: string;
  completedAt?: string;
  createdAt: string;
  team: EngagementTeamMember[];
  clientContacts: EngagementClientContact[];
  /** Legacy detail shape — prefer classRollups for workspace UI. */
  requestClasses: { requestClassId: number; name: string; sortOrder: number }[];
  classRollups: ClassRollup[];
  phaseCounts: {
    Planning: number;
    Execution: number;
    Reporting: number;
  };
  progressPercent: number;
  overdueCount: number;
  requestCount: number;
  submissionCounts: {
    uploaded: number;
    awaitingReview: number;
    returned: number;
    accepted: number;
    underReview: number;
  };
  allowedNextStages: string[];
  canComplete: boolean;
  missingRequestClassIds: number[];
  hasEngagementWideSignOff: boolean;
  signOffs: SignOff[];
  viewerIsLead: boolean;
  canManageEngagement: boolean;
  canTransitionEngagement: boolean;
  canSignOffEngagement: boolean;
  finalReportsNeedingFirmAction: number;
  analytics?: {
    aging: {
      noDue: number;
      overdue: number;
      dueToday: number;
      dueThisWeek: number;
      later: number;
    };
    workloadByMember: Array<{
      userId: string;
      fullName: string;
      memberRole?: "Lead" | "Member";
      open: number;
      overdue: number;
    }>;
    unassignedOpen: number;
    unassignedOverdue: number;
  };
}

export interface EngagementHistoryItem {
  id: string;
  fromStage?: string | null;
  toStage: string;
  note?: string | null;
  changedById?: string | null;
  changedByName?: string | null;
  changedAt: string;
}

export interface EngagementHistoryResponse {
  data: EngagementHistoryItem[];
}

export interface EngagementFilterOptions {
  clients: Array<{ id: string; name: string }>;
  departments: Array<{ id: number; name: string }>;
}

export function useEngagementsList(queryString: string) {
  return useQuery({
    queryKey: ["engagements", "list", queryString],
    queryFn: () =>
      bffApi<EngagementListResponse>(`/api/engagements?${queryString}`),
    placeholderData: keepPreviousData,
  });
}

/** Scoped client/department options for engagement list filters (works for Staff). */
export function useEngagementFilterOptions() {
  return useQuery({
    queryKey: ["engagements", "filter-options"],
    queryFn: () =>
      bffApi<EngagementFilterOptions>("/api/engagements/filter-options"),
    staleTime: 60_000,
  });
}

export function useEngagementWorkspace(id: string) {
  return useQuery({
    queryKey: ["engagements", id, "workspace"],
    queryFn: () =>
      bffApi<EngagementWorkspace>(`/api/engagements/${id}/workspace`),
    enabled: Boolean(id),
  });
}

export function useEngagementHistory(id: string) {
  return useQuery({
    queryKey: ["engagements", id, "history"],
    queryFn: async () => {
      const rows = await bffApi<
        EngagementHistoryItem[] | EngagementHistoryResponse
      >(`/api/engagements/${id}/history`);
      return { data: Array.isArray(rows) ? rows : rows.data };
    },
    enabled: Boolean(id),
  });
}

export function useCreateEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      clientId: string;
      engagementTypeId: number;
      departmentId: number;
      title: string;
      periodLabel?: string;
      startDate?: string;
      targetCompletionDate?: string;
      requestClassIds?: number[];
      clientContactUserIds: string[];
      mainClientContactUserId: string;
      emailClientContactUserIds?: string[];
    }) =>
      bffApi<EngagementWorkspace>("/api/engagements", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateEngagement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title?: string;
      periodLabel?: string;
      startDate?: string;
      targetCompletionDate?: string;
    }) =>
      bffApi<EngagementWorkspace>(`/api/engagements/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["engagements"] }),
        qc.invalidateQueries({ queryKey: ["engagements", id] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useCloneEngagement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      periodLabel?: string;
      startDate?: string;
      targetCompletionDate?: string;
    }) => bffApi<EngagementWorkspace>(`/api/engagements/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['engagements'] });
    },
  });
}

export function useTransitionEngagement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { toStage: string; note?: string }) =>
      bffApi<EngagementWorkspace>(`/api/engagements/${id}/transition`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["engagements"] }),
        qc.invalidateQueries({ queryKey: ["engagements", id] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });
}

export function useAddTeamMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { userId: string; memberRole?: "Lead" | "Member" }) =>
      bffApi<void>(`/api/engagements/${id}/team`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useElevateTeamMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<void>(`/api/engagements/${id}/team/${userId}/elevate`, {
        method: "POST",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useRemoveTeamMember(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<void>(`/api/engagements/${id}/team/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useAddEngagementClientContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      userId: string;
      isMain?: boolean;
      receiveEmail?: boolean;
    }) =>
      bffApi<EngagementWorkspace>(`/api/engagements/${id}/client-contacts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useUpdateEngagementClientContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      ...body
    }: {
      userId: string;
      isMain?: boolean;
      receiveEmail?: boolean;
    }) =>
      bffApi<EngagementWorkspace>(
        `/api/engagements/${id}/client-contacts/${userId}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useRemoveEngagementClientContact(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<EngagementWorkspace>(
        `/api/engagements/${id}/client-contacts/${userId}`,
        { method: "DELETE" },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useAddRequestClass(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestClassId: number; sortOrder?: number }) =>
      bffApi<void>(`/api/engagements/${id}/request-classes`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["engagements", id] }),
        qc.invalidateQueries({ queryKey: ["requests"] }),
      ]);
    },
  });
}

export function useRemoveRequestClass(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestClassId: number) =>
      bffApi<void>(`/api/engagements/${id}/request-classes/${requestClassId}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["engagements", id] }),
        qc.invalidateQueries({ queryKey: ["requests"] }),
      ]);
    },
  });
}

export function useCreateSignOff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { requestClassId?: number; note?: string }) =>
      bffApi<SignOff>(`/api/engagements/${id}/sign-offs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}

export function useRevokeSignOff(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      signOffId,
      reason,
    }: {
      signOffId: string;
      reason?: string;
    }) =>
      bffApi<SignOff>(`/api/engagements/${id}/sign-offs/${signOffId}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["engagements", id] });
    },
  });
}
