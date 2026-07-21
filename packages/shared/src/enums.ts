// Domain enums — the single source mirrored by the ERD and both apps.

export const ROLE_NAMES = [
  'Platform Admin',
  'Super Admin',
  'Staff',
  'Client',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export enum EngagementStatus {
  Planning = 'Planning',
  Fieldwork = 'Fieldwork',
  Review = 'Review',
  Completed = 'Completed',
  Archived = 'Archived',
}

/** Allowed forward transitions for an engagement's lifecycle. */
export const ENGAGEMENT_TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  [EngagementStatus.Planning]: [EngagementStatus.Fieldwork],
  [EngagementStatus.Fieldwork]: [EngagementStatus.Review, EngagementStatus.Planning],
  [EngagementStatus.Review]: [EngagementStatus.Completed, EngagementStatus.Fieldwork],
  [EngagementStatus.Completed]: [EngagementStatus.Archived, EngagementStatus.Review],
  [EngagementStatus.Archived]: [],
};

export enum EngagementMemberRole {
  Partner = 'Partner',
  Manager = 'Manager',
  Auditor = 'Auditor',
}

export enum DocumentCategory {
  WorkingPaper = 'WorkingPaper',
  FinalReport = 'FinalReport',
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
