/** BullMQ queue names — shared constants (never stringly-typed at call sites). */
export const QUEUE = {
  Notifications: 'notifications',
  Documents: 'documents',
  Scheduled: 'scheduled',
} as const;
export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

/** Typed job payloads. `outboxId` links a job back to its outbox row for idempotency. */
export interface NotificationJob {
  outboxId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface DocumentJob {
  outboxId: string;
  kind: 'thumbnail' | 'virus-scan' | 'zip-export';
  documentId?: string;
  engagementId?: string;
  payload: Record<string, unknown>;
}

export type ScheduledJobKind = 'deadline-reminder-scan' | 'daily-digest';
