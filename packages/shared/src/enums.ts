// Domain enums — the single source mirrored by the ERD and both apps.

export const ROLE_NAMES = [
  'Platform Admin',
  'Super Admin',
  'Staff',
  'Client',
  'Guest',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/** Engagement lifecycle stage (user-facing “Stage”, not Status). */
export enum EngagementStage {
  Planning = 'Planning',
  Execution = 'Execution',
  Reporting = 'Reporting',
  Completed = 'Completed',
  Archived = 'Archived',
}

/** @deprecated Use EngagementStage */
export const EngagementStatus = EngagementStage;
/** @deprecated Use EngagementStage */
export type EngagementStatus = EngagementStage;

/** Allowed transitions for an engagement's stage lifecycle. */
export const ENGAGEMENT_TRANSITIONS: Record<EngagementStage, EngagementStage[]> = {
  [EngagementStage.Planning]: [EngagementStage.Execution],
  [EngagementStage.Execution]: [EngagementStage.Reporting, EngagementStage.Planning],
  [EngagementStage.Reporting]: [EngagementStage.Completed, EngagementStage.Execution],
  [EngagementStage.Completed]: [EngagementStage.Archived, EngagementStage.Reporting],
  [EngagementStage.Archived]: [],
};

/** The three working phases an item (request/document) can belong to. */
export enum EngagementPhase {
  Planning = 'Planning',
  Execution = 'Execution',
  Reporting = 'Reporting',
}

/** Working phase stamped on requests from the engagement's current stage (terminal → Reporting). */
export function phaseForStage(stage: EngagementStage): EngagementPhase {
  switch (stage) {
    case EngagementStage.Planning:
      return EngagementPhase.Planning;
    case EngagementStage.Execution:
      return EngagementPhase.Execution;
    default:
      return EngagementPhase.Reporting; // Reporting / Completed / Archived
  }
}

/** @deprecated Use phaseForStage */
export const phaseForStatus = phaseForStage;

/** Role on a specific engagement team (not a platform login role). */
export enum EngagementMemberRole {
  Lead = 'Lead',
  Member = 'Member',
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
  /** Client is still uploading files; not visible to staff; no notification yet. */
  Draft = 'Draft',
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

/** Office→PDF preview pipeline status on uploaded files. */
export enum FilePreviewStatus {
  None = 'None',
  Pending = 'Pending',
  Ready = 'Ready',
  Failed = 'Failed',
}
