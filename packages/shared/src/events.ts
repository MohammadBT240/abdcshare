/** Outbox / domain event types. Emitted in-transaction, consumed by the worker. */
export const EVENT = {
  UserCreated: 'user.created',
  PasswordResetRequested: 'user.password_reset_requested',
  PasswordChanged: 'user.password_changed',
  EngagementCreated: 'engagement.created',
  EngagementStatusChanged: 'engagement.status_changed',
  RequestCreated: 'request.created',
  RequestStatusChanged: 'request.status_changed',
  DocumentCreated: 'document.created',
  DocumentFileUploaded: 'document.file_uploaded',
  DocumentStatusChanged: 'document.status_changed',
  ReportSentForReview: 'report.sent_for_review',
  ReportReviewDecided: 'report.review_decided',
  DocumentSubmitted: 'submission.created',
  DocumentReviewed: 'submission.reviewed',
  DiscussionPosted: 'discussion.posted',
  ReviewSubmitted: 'review.submitted',
  ReviewDecided: 'review.decided',
  NotificationEmail: 'notification.email',
} as const;
export type EventType = (typeof EVENT)[keyof typeof EVENT];
