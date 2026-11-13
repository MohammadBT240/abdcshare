import type { Permission } from '@abdcshare/shared';

/**
 * Plain-English labels for the "Who can do what" page (HC6). The page itself is generated from
 * ROLE_PERMISSIONS / DESIGNATION_PERMISSIONS, so it can't drift from what the API enforces;
 * a unit test fails if a permission is added without a label here.
 */
export interface PermissionRow {
  /** The permission this row describes. */
  permission: Permission;
  /** Other permissions the app also checks for this action (all must be held). */
  alsoNeeds?: Permission[];
  label: string;
}

export const PERMISSION_GROUPS: { area: string; items: PermissionRow[] }[] = [
  {
    area: 'Engagements & requests',
    items: [
      { permission: 'engagement:view', label: 'See engagements (staff: only ones they are on; clients: their own)' },
      { permission: 'engagement:create', label: 'Create and clone engagements' },
      { permission: 'engagement:update', label: 'Manage any engagement (details, team, contacts)' },
      { permission: 'engagement:transition', label: 'Move an engagement between stages (only on engagements you created)' },
      { permission: 'request:view', label: 'See requests' },
      { permission: 'request:create', label: 'Raise requests' },
      { permission: 'request:update', label: 'Attach or replace a request’s brief' },
      { permission: 'request:update', alsoNeeds: ['catalogue:view'], label: 'Edit requests and change their stage or status' },
      { permission: 'request:assign', alsoNeeds: ['catalogue:view'], label: 'Assign requests' },
    ],
  },
  {
    area: 'Documents & reviews',
    items: [
      { permission: 'document:view', label: 'See documents' },
      { permission: 'working-paper:upload', label: 'Upload working papers' },
      { permission: 'final-report:upload', label: 'Upload final reports' },
      { permission: 'supporting:upload', label: 'Upload planning and supporting documents (clients)' },
      { permission: 'document:delete', label: 'Delete any document' },
      { permission: 'document:export', label: 'Export documents' },
      { permission: 'submission:respond', label: 'Respond to requests with files (clients)' },
      { permission: 'submission:review', label: 'Accept or return client submissions' },
      { permission: 'discussion:participate', label: 'Take part in discussions' },
      { permission: 'review:submit', label: 'Submit work for review' },
      { permission: 'review:decide', label: 'Decide reviews (approve or send back)' },
      { permission: 'review:signoff', label: 'Sign off any engagement' },
      { permission: 'report-review:manage', label: 'Send final reports to the client for review; override the lock' },
      { permission: 'report-review:respond', label: 'Approve a final report or request changes (clients)' },
    ],
  },
  {
    area: 'Partner reports',
    items: [
      { permission: 'partner-report:submit', label: 'Write and submit a weekly report' },
      { permission: 'partner-report:view', label: 'Open Partner reports (your own)' },
      { permission: 'partner-report:review', label: 'Review submitted reports' },
      { permission: 'partner-report:view-all', label: 'See every partner’s reports' },
      { permission: 'partner-report:invite', label: 'Invite a guest to submit a report' },
    ],
  },
  {
    area: 'Library',
    items: [
      { permission: 'library:view', label: 'Browse, search and open library items' },
      { permission: 'library:contribute', label: 'Upload to the library; edit your own items' },
      { permission: 'library:curate', label: 'Curate the library (review queue, any item, transfers)' },
    ],
  },
  {
    area: 'Administration',
    items: [
      { permission: 'user:view', label: 'See users' },
      { permission: 'user:manage', label: 'Add, edit and deactivate users' },
      { permission: 'bulk-import:run', label: 'Bulk-import users' },
      { permission: 'client:view', label: 'See clients' },
      { permission: 'client:manage', label: 'Add and edit clients and contacts' },
      { permission: 'catalogue:view', label: 'See catalogues (request types, stages, …)' },
      { permission: 'catalogue:manage', label: 'Edit catalogues' },
      { permission: 'reference-data:view', label: 'See reference lists (titles, states, banks, …)' },
      { permission: 'reference-data:manage', label: 'Edit reference lists' },
      { permission: 'department:manage', label: 'Manage departments' },
      { permission: 'company-profile:view', label: 'See company profiles' },
      { permission: 'company-profile:manage', label: 'Edit company profiles' },
      { permission: 'audit:view', label: 'See the activity log' },
      { permission: 'help:manage', label: 'Write and edit Help Center articles' },
      { permission: 'system:jobs', label: 'Background jobs (queues, failed jobs, re-drive)' },
      { permission: 'notification:receive', label: 'Receive notifications' },
    ],
  },
];

/** Rules the matrix can't show — written next to it. */
export const PERMISSION_NOTES: string[] = [
  'An engagement’s lead (set on its Team tab) can also manage and sign off that engagement, whatever their role.',
  'Staff only see engagements, requests and documents for engagements they are on; clients only see their own organisation’s.',
  'Partner and Principal Partner are designations added to a Super Admin account by a Platform Admin; they add the permissions shown on top of the Super Admin role.',
  'Individual staff or client users can also be added to the partner-report roster, which lets them submit reports.',
];
