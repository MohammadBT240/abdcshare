'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export type ReportReviewState =
  | 'NotSent'
  | 'AwaitingClient'
  | 'ChangesRequested'
  | 'Locked'
  | 'Approved'
  | 'Overridden';
export type ReportReviewDecision = 'Pending' | 'Approved' | 'ChangesRequested';

export interface ReportReviewCycle {
  id: string;
  roundNo: number;
  fileVersion: number;
  decision: ReportReviewDecision;
  sentAt: string;
  decidedAt?: string | null;
  feedback?: string | null;
}

export interface ReportReviewStatus {
  documentId: string;
  engagementId: string;
  title: string;
  documentStatus: 'Draft' | 'Ready' | 'UnderReview' | 'SignedOff';
  reviewState: ReportReviewState;
  reviewRound: number;
  maxRounds: number;
  currentVersion: number;
  cycles: ReportReviewCycle[];
}

export interface ClientPendingReport {
  documentId: string;
  engagementId: string;
  title: string;
  reviewState: ReportReviewState;
  reviewRound: number;
  currentVersion: number;
}

const keys = {
  all: ['report-reviews'] as const,
  firm: (id: string) => ['report-reviews', 'firm', id] as const,
  clientList: (query: string) => ['report-reviews', 'client-list', query] as const,
  clientDetail: (id: string) => ['report-reviews', 'client-detail', id] as const,
};

async function invalidate(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  await queryClient.invalidateQueries({ queryKey: keys.all });
  if (id) await queryClient.invalidateQueries({ queryKey: ['documents', 'detail', id] });
}

export function useFirmReportReview(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.firm(id),
    queryFn: () => bffApi<ReportReviewStatus>(`/api/documents/${id}/final-report`),
    enabled: Boolean(id) && enabled,
  });
}

export function useSendFinalReport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      bffApi<ReportReviewStatus>(`/api/documents/${id}/final-report/send`, { method: 'POST' }),
    onSuccess: () => invalidate(queryClient, id),
  });
}

export function useOverrideFinalReport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) =>
      bffApi<ReportReviewStatus>(`/api/documents/${id}/final-report/override`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => invalidate(queryClient, id),
  });
}

export function useClientFinalReports(query: string) {
  return useQuery({
    queryKey: keys.clientList(query),
    queryFn: () =>
      bffApi<{ data: ClientPendingReport[]; meta: PageMeta }>(`/api/final-reports?${query}`),
    placeholderData: keepPreviousData,
  });
}

export function useClientFinalReport(id: string) {
  return useQuery({
    queryKey: keys.clientDetail(id),
    queryFn: () => bffApi<ReportReviewStatus>(`/api/final-reports/${id}`),
    enabled: Boolean(id),
  });
}

export function useDownloadClientFinalReport() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { url } = await bffApi<{ url: string }>(`/api/final-reports/${id}/download`);
      window.open(url, '_blank', 'noopener,noreferrer');
    },
  });
}

export function useRespondToFinalReport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      decision: Extract<ReportReviewDecision, 'Approved' | 'ChangesRequested'>;
      feedback?: string;
    }) =>
      bffApi<ReportReviewStatus>(`/api/final-reports/${id}/respond`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidate(queryClient, id),
  });
}
