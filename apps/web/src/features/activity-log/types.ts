import type { PageMeta } from '@abdcshare/api-client';

export interface ActivityLogRecord {
  id: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ActivityLogListResponse {
  data: ActivityLogRecord[];
  meta: PageMeta;
}

export const ACTIVITY_ENTITY_TYPE_OPTIONS = [
  { value: 'auth', label: 'Auth' },
  { value: 'users', label: 'Users' },
  { value: 'clients', label: 'Clients' },
  { value: 'engagements', label: 'Engagements' },
  { value: 'requests', label: 'Requests' },
  { value: 'documents', label: 'Documents' },
  { value: 'submissions', label: 'Submissions' },
  { value: 'messages', label: 'Messages' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'final-reports', label: 'Final reports' },
  { value: 'partner-reports', label: 'Partner reports' },
  { value: 'company-profiles', label: 'Company profiles' },
  { value: 'engagement-types', label: 'Engagement types' },
  { value: 'request-classes', label: 'Request classes' },
  { value: 'request-types', label: 'Request types' },
  { value: 'request-stages', label: 'Request stages' },
  { value: 'request-statuses', label: 'Request statuses' },
  { value: 'departments', label: 'Departments' },
  { value: 'notifications', label: 'Notifications' },
] as const;
