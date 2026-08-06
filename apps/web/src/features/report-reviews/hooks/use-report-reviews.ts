'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';
import type { FilePreviewResult } from '@/components/files/file-viewer-dialog';

export type ReportReviewState =
  | 'NotSent'
  | 'AwaitingClient'
  | 'ChangesRequested'
  | 'Locked'
  | 'Approved'
  | 'Overridden';
export type ReportReviewDecision = 'Pending' | 'Approved' | 'ChangesRequested';

export interface ReportFile {
  id: string;
  version: number;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
}

export interface ReportReviewCycle {
  id: string;
  roundNo: number;
  fileVersion: number;
  decision: ReportReviewDecision;
  sentAt: string;
  decidedAt?: string | null;
  feedback?: string | null;
  file?: ReportFile | null;
}

export interface ReportReviewStatus {
  documentId: string;
  engagementId: string;
  engagementReferenceCode: string;
  engagementTitle: string;
  title: string;
  documentStatus: 'Draft' | 'Ready' | 'UnderReview' | 'SignedOff';
  reviewState: ReportReviewState;
  reviewRound: number;
  maxRounds: number;
  currentVersion: number;
  currentFile?: ReportFile | null;
  cycles: ReportReviewCycle[];
}

export interface ClientPendingReport {
  documentId: string;
  engagementId: string;
  engagementReferenceCode: string;
  engagementTitle: string;
  title: string;
  reviewState: ReportReviewState;
  reviewRound: number;
  currentVersion: number;
  sentAt?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
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
    mutationFn: () => sendFinalReportToClient(id),
    onSuccess: () => invalidate(queryClient, id),
  });
}

/** Send (or resend) a final-report draft to the client for review. */
export async function sendFinalReportToClient(documentId: string) {
  return bffApi<ReportReviewStatus>(`/api/documents/${documentId}/final-report/send`, {
    method: 'POST',
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

export interface FirmReportListItem {
  documentId: string;
  engagementId: string;
  engagementReferenceCode: string;
  engagementTitle: string;
  title: string;
  reviewState: ReportReviewState;
  reviewRound: number;
  currentVersion: number;
  latestFeedback?: string | null;
  updatedAt: string;
}

export function useFirmFinalReports(query: string) {
  return useQuery({
    queryKey: [...keys.all, 'firm-list', query] as const,
    queryFn: () =>
      bffApi<{ data: FirmReportListItem[]; meta: PageMeta }>(
        `/api/final-reports/firm?${query}`,
      ),
    placeholderData: keepPreviousData,
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

export async function fetchClientReportFilePreview(
  documentId: string,
  fileId: string,
  opts?: { retryFailed?: boolean },
): Promise<FilePreviewResult> {
  const qs = opts?.retryFailed ? '?retryFailed=1' : '';
  return bffApi<FilePreviewResult>(
    `/api/final-reports/${documentId}/files/${fileId}/preview${qs}`,
  );
}

export async function fetchClientReportZipEntries(documentId: string, fileId: string) {
  return bffApi<{ entries: Array<{ name: string; size: number; isDirectory: boolean }> }>(
    `/api/final-reports/${documentId}/files/${fileId}/zip-entries`,
  );
}

export async function fetchClientReportZipEntry(
  documentId: string,
  fileId: string,
  entryPath: string,
) {
  const qs = new URLSearchParams({ path: entryPath });
  return bffApi<{ url: string; fileName: string; mimeType: string }>(
    `/api/final-reports/${documentId}/files/${fileId}/zip-entry?${qs}`,
  );
}

export async function openClientReportFileDownload(documentId: string, fileId: string) {
  const { url } = await bffApi<{ url: string }>(
    `/api/final-reports/${documentId}/files/${fileId}/download`,
  );
  window.open(url, '_blank', 'noopener,noreferrer');
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
