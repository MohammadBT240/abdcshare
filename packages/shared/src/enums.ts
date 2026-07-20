// Domain enums — the single source mirrored by the ERD and both apps.

export const ROLE_NAMES = [
  'Platform Admin',
  'Super Admin',
  'Auditor',
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
