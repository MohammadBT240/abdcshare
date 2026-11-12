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

/**
 * Preferred reporting rhythm for a roster member.
 * Soft preference only — never blocks ad-hoc submit (`None` = reminders off by default intent).
 */
export enum PartnerReportCadence {
  Weekly = 'Weekly',
  Monthly = 'Monthly',
  Quarterly = 'Quarterly',
  None = 'None',
}

export enum SubmissionStatus {
  /** Client is still uploading files; not visible to staff; no notification yet. */
  Draft = 'Draft',
  Pending = 'Pending',
  /** Staff has opened / claimed the file; still awaiting Accept/Return. File-level only. */
  UnderReview = 'UnderReview',
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

/** Staff knowledge library item lifecycle. Draft = file not yet confirmed. */
export enum LibraryItemStatus {
  Draft = 'Draft',
  Published = 'Published',
  Archived = 'Archived',
  /** Virus scan found malware (S3, D24): hidden from everyone but curators; object under quarantine/. */
  Quarantined = 'Quarantined',
}

/** ClamAV scan state of a library item's file (S3, D24/D25). Downloads need Clean. */
export enum LibraryScanStatus {
  Pending = 'Pending',
  Clean = 'Clean',
  Infected = 'Infected',
  Error = 'Error',
}

/** Why an Office → PDF preview failed (S3, D28). */
export enum PreviewErrorCode {
  PasswordProtected = 'password_protected',
  Corrupt = 'corrupt',
  Timeout = 'timeout',
  Unknown = 'unknown',
}

/** Who can see a library item (internal users only, always). */
export enum LibraryVisibility {
  /** Every internal user. */
  Firm = 'Firm',
  /** Only users in the item's departments (+ uploader + curators). */
  Departments = 'Departments',
}

/** What a library collection groups items by (S1). Drives icons and copy. */
export enum LibraryCollectionType {
  Training = 'Training',
  Workshop = 'Workshop',
  Conference = 'Conference',
  Project = 'Project',
  Programme = 'Programme',
  Other = 'Other',
}

export enum LibraryCollectionStatus {
  Active = 'Active',
  Archived = 'Archived',
}

/** Library activity log actions (S2, D15). Every event counts — no de-duplication. */
export enum LibraryEventAction {
  Viewed = 'Viewed',
  Downloaded = 'Downloaded',
  Uploaded = 'Uploaded',
  FileReplaced = 'FileReplaced',
  Edited = 'Edited',
  VisibilityChanged = 'VisibilityChanged',
  Archived = 'Archived',
  Restored = 'Restored',
  Deleted = 'Deleted',
  Reported = 'Reported',
  ReportResolved = 'ReportResolved',
  OwnershipTransferred = 'OwnershipTransferred',
  AddedToCollection = 'AddedToCollection',
  RemovedFromCollection = 'RemovedFromCollection',
  ZipExported = 'ZipExported',
  Quarantined = 'Quarantined',
}

/** How a library item may be shared (S2, D21). */
export enum LibraryLicence {
  FreeToShare = 'FreeToShare',
  InternalUseOnly = 'InternalUseOnly',
  Licensed = 'Licensed',
}

/** Why someone reported a library item (S2, D19). */
export enum LibraryReportReason {
  ClientConfidential = 'ClientConfidential',
  Copyright = 'Copyright',
  OutdatedOrWrong = 'OutdatedOrWrong',
  Inappropriate = 'Inappropriate',
  Other = 'Other',
}

export enum LibraryReportStatus {
  Open = 'Open',
  Dismissed = 'Dismissed',
  Actioned = 'Actioned',
}

/** What a curator did about a report (S2, D20). */
export enum LibraryReportOutcome {
  Dismiss = 'Dismiss',
  Restrict = 'Restrict',
  Archive = 'Archive',
  Delete = 'Delete',
}
