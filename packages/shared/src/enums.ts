// Domain enums — the single source mirrored by the ERD and both apps.

export const ROLE_NAMES = [
  'Platform Admin',
  'Super Admin',
  'Staff',
  'Client',
  'Guest',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export enum EngagementStatus {
  Planning = 'Planning',
  Execution = 'Execution',
  Reporting = 'Reporting',
  Completed = 'Completed',
  Archived = 'Archived',
}

/** Allowed forward transitions for an engagement's lifecycle. */
export const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  [EngagementStatus.Planning]: [EngagementStatus.Execution],
  [EngagementStatus.Execution]: [EngagementStatus.Reporting, EngagementStatus.Planning],
  [EngagementStatus.Reporting]: [EngagementStatus.Completed, EngagementStatus.Execution],
  [EngagementStatus.Completed]: [EngagementStatus.Archived, EngagementStatus.Reporting],
  [EngagementStatus.Archived]: [],
};

/** The three working stages an item (request/document) can belong to. */
export enum EngagementPhase {
  Planning = 'Planning',
  Execution = 'Execution',
  Reporting = 'Reporting',
}

/** Which working stage the engagement's status maps to (terminal → Reporting). */
export function phaseForStatus(status: EngagementStatus): EngagementPhase {
  switch (status) {
    case EngagementStatus.Planning:
      return EngagementPhase.Planning;
    case EngagementStatus.Execution:
      return EngagementPhase.Execution;
    default:
      return EngagementPhase.Reporting; // Reporting / Completed / Archived
  }
}

export enum EngagementMemberRole {
  Partner = 'Partner',
  Manager = 'Manager',
  Auditor = 'Auditor',
}

export enum DocumentCategory {
  WorkingPaper = 'WorkingPaper',
  FinalReport = 'FinalReport',
  Supporting = 'Supporting', // engagement-level reference material, no request class
}

export enum DocumentStatus {
  Draft = 'Draft',
  Ready = 'Ready',
  UnderReview = 'UnderReview',
  SignedOff = 'SignedOff',
}

/** Role a person plays on a document (legacy per-line auditors/advisors/staffs). */
export enum DocumentParticipantRole {
  Auditor = 'Auditor',
  Advisor = 'Advisor',
  Staff = 'Staff',
}

/** Client-review lifecycle of a final-report draft (see report review cycles). */
export enum ReportReviewState {
  NotSent = 'NotSent',
  AwaitingClient = 'AwaitingClient',
  ChangesRequested = 'ChangesRequested',
  Locked = 'Locked', // 3 cycles used without approval — needs SA override
  Approved = 'Approved', // client approved → finalised/issued
  Overridden = 'Overridden', // SA override after lock → finalised/issued
}

/** A client's decision on one review cycle. */
export enum ReportReviewDecision {
  Pending = 'Pending',
  Approved = 'Approved',
  ChangesRequested = 'ChangesRequested',
}

/** Max client-review cycles a final report may go through before it locks. */
export const MAX_REPORT_REVIEW_ROUNDS = 3;

// ---- Partner / Chairman reports -------------------------------------------

export enum PartnerReportStatus {
  Draft = 'Draft',
  Submitted = 'Submitted',
  Reviewed = 'Reviewed',
}

export enum ReportingOfficerTitle {
  Partner = 'Partner',
  Director = 'Director',
  HeadOfDepartment = 'HeadOfDepartment',
  ManagingConsultant = 'ManagingConsultant',
}

export enum ReportPeriodType {
  Weekly = 'Weekly',
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  AdHoc = 'AdHoc',
}

export enum ReportCurrency {
  NGN = 'NGN',
  USD = 'USD',
}

/** Status of a client/engagement update row in a report. */
export enum ReportUpdateStatus {
  OnTrack = 'OnTrack',
  Watch = 'Watch',
  AtRisk = 'AtRisk',
  NewWin = 'NewWin',
}

/** Priority of a "matter requiring the Chairman's decision" row. */
export enum ReportDecisionPriority {
  Urgent = 'Urgent',
  ThisPeriod = 'ThisPeriod',
  ForInformation = 'ForInformation',
}

export enum PartnerReportInviteStatus {
  Invited = 'Invited',
  Submitted = 'Submitted',
  Revoked = 'Revoked',
}

export enum SubmissionStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Returned = 'Returned',
}

export enum ReviewStatus {
  ForReview = 'ForReview',
  Approved = 'Approved',
  SentBack = 'SentBack',
}

export enum OutboxStatus {
  Pending = 'Pending',
  Queued = 'Queued',
  Sent = 'Sent',
  Failed = 'Failed',
}
