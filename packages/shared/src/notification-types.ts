/** Canonical notification type strings for emit + preference UI. */
export const NOTIFICATION_TYPES = [
  'engagement.created',
  'engagement.stage_changed',
  'engagement.team_changed',
  'engagement.class_changed',
  'engagement.signoff',
  'engagement.signoff_revoked',
  'request.created',
  'request.assigned',
  'request.unassigned',
  'request.updated',
  'request.stage_changed',
  'request.status_changed',
  'request.deadline',
  'request.overdue',
  'document.uploaded',
  'document.status_changed',
  'document.export_ready',
  'discussion.message',
  'submission.created',
  'submission.reviewed',
  'submission.export_ready',
  'submission.export_failed',
  'review.requested',
  'review.decided',
  'report.review_requested',
  'report.review_decided',
  'report.finalised',
  'partner-report.submitted',
  'partner-report.reviewed',
  'partner-report.reminder',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationTypeMeta {
  type: NotificationType;
  label: string;
  description: string;
  /** Preference UI groups. */
  category: 'engagement' | 'request' | 'document' | 'collaboration' | 'review' | 'partner-report';
}

export const NOTIFICATION_TYPE_CATALOG: NotificationTypeMeta[] = [
  {
    type: 'engagement.created',
    label: 'Engagement created',
    description: 'When a new engagement is set up',
    category: 'engagement',
  },
  {
    type: 'engagement.stage_changed',
    label: 'Engagement stage changed',
    description: 'When an engagement moves between Planning, Execution, Reporting, Completed, or Archived',
    category: 'engagement',
  },
  {
    type: 'engagement.team_changed',
    label: 'Engagement team changed',
    description: 'When someone is added to or removed from the engagement team',
    category: 'engagement',
  },
  {
    type: 'engagement.class_changed',
    label: 'Request class scope changed',
    description: 'When a request class is added to or removed from an engagement',
    category: 'engagement',
  },
  {
    type: 'engagement.signoff',
    label: 'Engagement sign-off',
    description: 'When a request class or the whole engagement is signed off',
    category: 'engagement',
  },
  {
    type: 'engagement.signoff_revoked',
    label: 'Sign-off revoked',
    description: 'When a sign-off is revoked',
    category: 'engagement',
  },
  {
    type: 'request.created',
    label: 'Request created',
    description: 'When a request is created without assignees (team notified)',
    category: 'request',
  },
  {
    type: 'request.assigned',
    label: 'Request assigned',
    description: 'When you are assigned to a request',
    category: 'request',
  },
  {
    type: 'request.unassigned',
    label: 'Request unassigned',
    description: 'When you are removed from a request',
    category: 'request',
  },
  {
    type: 'request.updated',
    label: 'Request updated',
    description: 'When request details change',
    category: 'request',
  },
  {
    type: 'request.stage_changed',
    label: 'Request stage changed',
    description: 'When a request moves to a new stage',
    category: 'request',
  },
  {
    type: 'request.status_changed',
    label: 'Request status changed',
    description: 'When a request status changes',
    category: 'request',
  },
  {
    type: 'request.deadline',
    label: 'Request due soon',
    description: 'Reminder when a request is due within 24 hours',
    category: 'request',
  },
  {
    type: 'request.overdue',
    label: 'Request overdue',
    description: 'Reminder when a request is past its due date',
    category: 'request',
  },
  {
    type: 'document.uploaded',
    label: 'Document uploaded',
    description: 'When a document or file is uploaded on an engagement',
    category: 'document',
  },
  {
    type: 'document.status_changed',
    label: 'Document status changed',
    description: 'When a document status changes',
    category: 'document',
  },
  {
    type: 'document.export_ready',
    label: 'Document export ready',
    description: 'When a requested document archive is ready to download',
    category: 'document',
  },
  {
    type: 'discussion.message',
    label: 'Discussion message',
    description: 'When someone posts on a request discussion',
    category: 'collaboration',
  },
  {
    type: 'submission.created',
    label: 'Client submission',
    description: 'When a client responds to a request',
    category: 'collaboration',
  },
  {
    type: 'submission.reviewed',
    label: 'Submission reviewed',
    description: 'When your submission is accepted or returned',
    category: 'collaboration',
  },
  {
    type: 'submission.export_ready',
    label: 'Submission download ready',
    description: 'When a requested archive of a client response is ready to download',
    category: 'collaboration',
  },
  {
    type: 'submission.export_failed',
    label: 'Submission download failed',
    description: 'When building a client-response archive fails',
    category: 'collaboration',
  },
  {
    type: 'review.requested',
    label: 'Review requested',
    description: 'When you are asked to review work',
    category: 'review',
  },
  {
    type: 'review.decided',
    label: 'Review decided',
    description: 'When a review is approved or sent back',
    category: 'review',
  },
  {
    type: 'report.review_requested',
    label: 'Final report for review',
    description: 'When a final report is sent to the client',
    category: 'review',
  },
  {
    type: 'report.review_decided',
    label: 'Final report decision',
    description: 'When the client decides on a final report',
    category: 'review',
  },
  {
    type: 'report.finalised',
    label: 'Final report finalised',
    description: 'When a final report is locked/finalised',
    category: 'review',
  },
  {
    type: 'partner-report.submitted',
    label: 'Partner report submitted',
    description: 'When a Chairman report is submitted',
    category: 'partner-report',
  },
  {
    type: 'partner-report.reviewed',
    label: 'Partner report reviewed',
    description: 'When your Chairman report is reviewed',
    category: 'partner-report',
  },
  {
    type: 'partner-report.reminder',
    label: 'Partner report reminder',
    description: 'Reminder to submit a Chairman report',
    category: 'partner-report',
  },
];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
