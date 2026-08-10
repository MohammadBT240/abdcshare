'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PageMeta } from '@abdcshare/api-client';
import { bffApi } from '@/lib/bff/client';

export type PartnerReportStatus = 'Draft' | 'Submitted' | 'Reviewed';
export type ReportingOfficerTitle =
  | 'Partner'
  | 'Director'
  | 'HeadOfDepartment'
  | 'ManagingConsultant';
export type ReportPeriodType = 'Weekly' | 'Monthly' | 'Quarterly' | 'AdHoc';
export type ReportCurrency = 'NGN' | 'USD';
export type ReportUpdateStatus = 'OnTrack' | 'Watch' | 'AtRisk' | 'NewWin';
export type ReportDecisionPriority = 'Urgent' | 'ThisPeriod' | 'ForInformation';
export type InviteOutcome = 'invited' | 'allowed' | 'reminded';
export type PartnerReportCadence = 'Weekly' | 'Monthly' | 'Quarterly' | 'None';
export type ReporterExpectation = 'ok' | 'requested' | 'due';

export interface EngagementUpdate {
  clientEngagement: string;
  update: string;
  status: ReportUpdateStatus;
}

export interface ReportDecision {
  decision: string;
  priority: ReportDecisionPriority;
}

export interface BillingItem {
  description: string;
  amount: string;
  amountReceived: string;
}

export interface PartnerReport {
  id: string;
  submittedById: string;
  submittedByName?: string | null;
  reportingOfficerName: string;
  officerTitle?: ReportingOfficerTitle | null;
  department: string;
  periodType: ReportPeriodType;
  periodLabel?: string | null;
  executiveSummary?: string | null;
  currency?: ReportCurrency | null;
  feeRevenue?: string | null;
  billingItems: BillingItem[];
  collectionsReceived?: string | null;
  outstanding?: string | null;
  remark?: string | null;
  peopleCapacity?: string | null;
  outlook?: string | null;
  status: PartnerReportStatus;
  submittedAt?: string | null;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  isGuest: boolean;
  engagementUpdates: EngagementUpdate[];
  decisions: ReportDecision[];
  createdAt: string;
}

export interface SavePartnerReportInput {
  reportingOfficerName: string;
  officerTitle?: ReportingOfficerTitle;
  department: string;
  periodType: ReportPeriodType;
  periodLabel?: string;
  executiveSummary?: string;
  currency?: ReportCurrency;
  billingItems?: BillingItem[];
  remark?: string;
  peopleCapacity?: string;
  outlook?: string;
  engagementUpdates?: EngagementUpdate[];
  decisions?: ReportDecision[];
}

export interface InviteResult {
  outcome: InviteOutcome;
  email: string;
  userId: string;
  inviteId?: string | null;
}

export interface Reporter {
  userId: string;
  fullName: string;
  email: string;
  kind: 'partner' | 'guest' | 'staff' | 'client';
  inviteStatus?: string | null;
  allowedAt?: string | null;
  cadence: PartnerReportCadence;
  remindersEnabled: boolean;
  financialsEnabled: boolean;
  reportRequestedAt?: string | null;
  requestNote?: string | null;
  lastSubmittedAt?: string | null;
  expectation: ReporterExpectation;
}

export interface MyReportingStatus {
  canSubmit: boolean;
  cadence?: PartnerReportCadence | null;
  remindersEnabled: boolean;
  financialsEnabled: boolean;
  reportRequestedAt?: string | null;
  requestNote?: string | null;
  lastSubmittedAt?: string | null;
  expectation: ReporterExpectation;
}

export interface PartnerReportDashboard {
  total: number;
  drafts: number;
  awaitingReview: number;
  reviewed: number;
  awaitingDecision: number;
}

const keys = {
  all: ['partner-reports'] as const,
  list: (query: string) => ['partner-reports', 'list', query] as const,
  detail: (id: string) => ['partner-reports', 'detail', id] as const,
  dashboard: ['partner-reports', 'dashboard'] as const,
  reporters: ['partner-reports', 'reporters'] as const,
  myStatus: ['partner-reports', 'me-status'] as const,
};

async function invalidateAll(qc: ReturnType<typeof useQueryClient>, id?: string) {
  await qc.invalidateQueries({ queryKey: keys.all });
  if (id) await qc.invalidateQueries({ queryKey: keys.detail(id) });
}

function invalidateRoster(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: keys.reporters });
  void qc.invalidateQueries({ queryKey: keys.myStatus });
  void qc.invalidateQueries({ queryKey: keys.all });
}

/** Download file (CSV/PDF) via BFF proxy (cookie auth). */
export async function downloadPartnerReportsCsv(path: string, filename: string) {
  const normalized = path.replace(/^\/api\//, '').replace(/^\//, '');
  const res = await fetch(`/api/bff/proxy/${normalized}`, { method: 'GET' });
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

export function usePartnerReportsList(query: string) {
  return useQuery({
    queryKey: keys.list(query),
    queryFn: () =>
      bffApi<{ data: PartnerReport[]; meta: PageMeta }>(
        `/api/partner-reports${query ? `?${query}` : ''}`,
      ),
    placeholderData: keepPreviousData,
  });
}

export function usePartnerReport(id: string, enabled = true) {
  return useQuery({
    queryKey: keys.detail(id),
    queryFn: () => bffApi<PartnerReport>(`/api/partner-reports/${id}`),
    enabled: Boolean(id) && enabled,
  });
}

export function usePartnerReportDashboard(enabled = true) {
  return useQuery({
    queryKey: keys.dashboard,
    queryFn: () => bffApi<PartnerReportDashboard>('/api/partner-reports/dashboard'),
    enabled,
  });
}

export function usePartnerReporters(enabled = true) {
  return useQuery({
    queryKey: keys.reporters,
    queryFn: () => bffApi<{ data: Reporter[] }>('/api/partner-reports/reporters'),
    enabled,
  });
}

export function useMyReportingStatus(enabled = true) {
  return useQuery({
    queryKey: keys.myStatus,
    queryFn: () => bffApi<MyReportingStatus>('/api/partner-reports/me/status'),
    enabled,
  });
}

export function useCreatePartnerReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePartnerReportInput) =>
      bffApi<PartnerReport>('/api/partner-reports', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (row) => {
      void invalidateAll(qc, row.id);
      invalidateRoster(qc);
    },
  });
}

export function useUpdatePartnerReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SavePartnerReportInput) =>
      bffApi<PartnerReport>(`/api/partner-reports/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void invalidateAll(qc, id),
  });
}

export function useSubmitPartnerReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bffApi<PartnerReport>(`/api/partner-reports/${id}/submit`, { method: 'POST' }),
    onSuccess: () => {
      void invalidateAll(qc, id);
      invalidateRoster(qc);
    },
  });
}

export function useReviewPartnerReport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { notes?: string }) =>
      bffApi<PartnerReport>(`/api/partner-reports/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => void invalidateAll(qc, id),
  });
}

export function useInvitePartnerReporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      email: string;
      fullName: string;
      title?: ReportingOfficerTitle;
      cadence?: PartnerReportCadence;
      remindersEnabled?: boolean;
      financialsEnabled?: boolean;
    }) =>
      bffApi<InviteResult>('/api/partner-reports/invites', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateRoster(qc),
  });
}

export function useUpdatePartnerReporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      userId: string;
      cadence?: PartnerReportCadence;
      remindersEnabled?: boolean;
      financialsEnabled?: boolean;
    }) =>
      bffApi<Reporter>(`/api/partner-reports/reporters/${input.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          cadence: input.cadence,
          remindersEnabled: input.remindersEnabled,
          financialsEnabled: input.financialsEnabled,
        }),
      }),
    onSuccess: () => invalidateRoster(qc),
  });
}

export function useRequestPartnerReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; note?: string }) =>
      bffApi<Reporter>(`/api/partner-reports/reporters/${input.userId}/request`, {
        method: 'POST',
        body: JSON.stringify({ note: input.note }),
      }),
    onSuccess: () => invalidateRoster(qc),
  });
}

export function useRemindPartnerReporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<Reporter>(`/api/partner-reports/reporters/${userId}/remind`, { method: 'POST' }),
    onSuccess: () => invalidateRoster(qc),
  });
}

export function useRemovePartnerReporter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      bffApi<void>(`/api/partner-reports/reporters/${userId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRoster(qc),
  });
}
