/** Role-shaped home dashboard payload (GET /dashboard). */

export type DashboardKind = 'governance' | 'firm' | 'staff' | 'client' | 'guest';

export type AttentionSeverity = 'critical' | 'warning' | 'info';

export interface AttentionItem {
  id: string;
  title: string;
  href: string;
  severity: AttentionSeverity;
  meta?: string;
}

export interface PartnerStripPrincipal {
  mode: 'principal';
  total: number;
  drafts: number;
  awaitingReview: number;
  reviewed: number;
  awaitingDecision: number;
}

export interface PartnerStripReporter {
  mode: 'reporter';
  canSubmit: boolean;
  expectation: 'ok' | 'requested' | 'due';
  cadence?: string | null;
  reportRequestedAt?: Date | null;
  requestNote?: string | null;
  lastSubmittedAt?: Date | null;
  drafts: number;
  submitted: number;
  reviewed: number;
}

export type PartnerStrip = PartnerStripPrincipal | PartnerStripReporter;

interface DashboardBase {
  notifications: { unread: number };
  attention: AttentionItem[];
  partner?: PartnerStrip;
}

export interface TrendPoint {
  /** ISO date (yyyy-mm-dd) of the bucket start. */
  date: string;
  label: string;
  value: number;
}

export interface WeekActivityPoint {
  weekStart: string;
  label: string;
  created: number;
  completed: number;
}

export interface WorkloadRow {
  userId: string;
  fullName: string;
  open: number;
  overdue: number;
}

export interface GovernanceDashboard extends DashboardBase {
  kind: 'governance';
  users: {
    total: number;
    byRole: Record<string, number>;
    inactive: number;
    mustChangePassword: number;
  };
  catalogue: {
    requestTypes: number;
    requestStages: number;
    requestStatuses: number;
    engagementTypes: number;
    departments: number;
    emptySignals: string[];
  };
  audit: { last7Days: number; trend: TrendPoint[] };
}

export interface FirmDashboard extends DashboardBase {
  kind: 'firm';
  engagements: { total: number; byStage: Record<string, number> };
  requests: {
    inScope: number;
    open: number;
    done: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
  };
  finalReports: { awaitingClientReview: number; needsFirmAction: number };
  progressPercent: number;
  requestTrend: WeekActivityPoint[];
  submissionsByStatus: Record<string, number>;
  workloadTop: WorkloadRow[];
}

export interface StaffDashboard extends DashboardBase {
  kind: 'staff';
  assigned: { open: number; done: number; overdue: number; dueSoon: number };
  dueByDay: TrendPoint[];
  myEngagements: Array<{
    id: string;
    title: string;
    referenceCode: string;
    overdueCount: number;
    nearestDue: string | null;
  }>;
  submissionsAwaitingReview: number;
  reviewsPendingDecision: number;
}

export interface ClientDashboard extends DashboardBase {
  kind: 'client';
  outstandingRequests: number;
  returnedSubmissions: number;
  finalReportsAwaitingMe: number;
  submissionsByStatus: Record<string, number>;
  recentEngagements: Array<{
    id: string;
    title: string;
    referenceCode: string;
    stage: string;
  }>;
}

export interface GuestDashboard extends DashboardBase {
  kind: 'guest';
  reporting: {
    canSubmit: boolean;
    expectation: 'ok' | 'requested' | 'due';
    cadence?: string | null;
    reportRequestedAt?: Date | null;
    requestNote?: string | null;
    lastSubmittedAt?: Date | null;
    drafts: number;
    submitted: number;
    reviewed: number;
  };
}

export type DashboardSummary =
  | GovernanceDashboard
  | FirmDashboard
  | StaffDashboard
  | ClientDashboard
  | GuestDashboard;
