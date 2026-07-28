import type { RoleName } from './enums';

/** Super-Admin sub-flag driving the partner weekly-reporting feature. */
export type PartnerDesignation = 'PrincipalPartner' | 'Partner';

/** The full permission vocabulary. One source for API guards AND the web menu. */
export const PERMISSIONS = [
  // governance
  'user:manage',
  'user:view',
  'client:manage',
  'client:view',
  'catalogue:manage', // FS lines, request types, stages, statuses, engagement types
  'catalogue:view',
  'reference-data:manage', // global_* lookups (titles, genders, states, banks, ...)
  'reference-data:view',
  'department:manage',
  'company-profile:manage',
  'company-profile:view',
  'bulk-import:run', // bulk user import (template/preview/validate/import)
  // engagements & requests
  'engagement:create',
  'engagement:update',
  'engagement:transition',
  'engagement:view',
  'request:create',
  'request:update',
  'request:assign',
  'request:view',
  // documents (split upload per category)
  'working-paper:upload',
  'final-report:upload', // Super Admin only
  'document:view',
  'document:delete',
  'document:export',
  // client interaction
  'submission:respond',
  'submission:review',
  'discussion:participate',
  // reviews & sign-off
  'review:submit',
  'review:decide',
  'review:signoff',
  // final-report client review cycles
  'report-review:manage', // SA: send draft to client, override lock
  'report-review:respond', // Client: approve / request changes
  // partner weekly reports (granted by DESIGNATION, not role)
  'partner-report:submit',
  'partner-report:view', // list/read the module (authors see own; Chairman sees all)
  'partner-report:review',
  'partner-report:view-all',
  'partner-report:invite', // Principal Partner: invite a Guest to submit a report
  // cross-cutting
  'notification:receive',
  'audit:view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_VIEW: Permission[] = ['engagement:view', 'request:view', 'document:view', 'notification:receive'];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  'Platform Admin': [
    'user:manage', 'user:view', 'client:manage', 'client:view',
    'catalogue:manage', 'catalogue:view', 'reference-data:manage', 'reference-data:view',
    'department:manage', 'company-profile:manage', 'company-profile:view',
    'bulk-import:run', 'audit:view', 'notification:receive',
  ],
  'Super Admin': [
    ...ALL_VIEW, 'user:view', 'client:view', 'catalogue:view', 'reference-data:view', 'company-profile:view',
    'engagement:create', 'engagement:update', 'engagement:transition',
    'request:create', 'request:update', 'request:assign',
    'working-paper:upload', 'final-report:upload', 'document:delete', 'document:export',
    'submission:review', 'discussion:participate',
    'review:decide', 'review:signoff', 'report-review:manage', 'audit:view',
  ],
  // Staff are the working practitioners. Engagements are created/managed by Super
  // Admin only; staff work inside the engagements they're attached to (raise
  // requests, review submissions, upload working papers). Row-level scope is
  // enforced in the services by engagement team membership.
  Staff: [
    ...ALL_VIEW, 'company-profile:view',
    'request:create', 'request:update', 'request:assign',
    'working-paper:upload', 'document:export',
    'submission:review', 'discussion:participate',
    'review:submit',
  ],
  Client: [
    'engagement:view', 'request:view', 'submission:respond', 'discussion:participate',
    'report-review:respond', 'notification:receive',
  ],
  // Guests are invited by the Principal Partner solely to submit a report to the Chairman.
  Guest: ['partner-report:submit', 'partner-report:view', 'notification:receive'],
};

/** Extra permissions granted by a Super Admin's partner designation (additive to role). */
export const DESIGNATION_PERMISSIONS: Record<PartnerDesignation, Permission[]> = {
  Partner: ['partner-report:submit', 'partner-report:view'],
  PrincipalPartner: [
    'partner-report:view', 'partner-report:review', 'partner-report:view-all', 'partner-report:invite',
  ],
};

/** Resolve the effective permission set for a role + optional partner designation. */
export function resolvePermissions(role: RoleName, designation?: PartnerDesignation | null): Set<Permission> {
  const perms = new Set<Permission>(ROLE_PERMISSIONS[role] ?? []);
  if (designation) for (const p of DESIGNATION_PERMISSIONS[designation]) perms.add(p);
  return perms;
}

export function hasPermission(
  role: RoleName,
  permission: Permission,
  designation?: PartnerDesignation | null,
): boolean {
  return resolvePermissions(role, designation).has(permission);
}

/** @deprecated use hasPermission — kept for existing call sites (role-only). */
export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}
