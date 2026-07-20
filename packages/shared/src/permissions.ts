import type { RoleName } from './enums';

/** The full permission vocabulary. One source for API guards AND the web menu. */
export const PERMISSIONS = [
  'user:manage',
  'user:view',
  'catalogue:manage',
  'catalogue:view',
  'department:manage',
  'company-profile:manage',
  'company-profile:view',
  'engagement:create',
  'engagement:update',
  'engagement:transition',
  'engagement:view',
  'request:create',
  'request:update',
  'request:assign',
  'request:view',
  'document:upload',
  'document:view',
  'document:delete',
  'submission:respond',
  'submission:review',
  'discussion:participate',
  'review:submit',
  'review:decide',
  'review:signoff',
  'notification:receive',
  'audit:view',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL_VIEW: Permission[] = ['engagement:view', 'request:view', 'document:view', 'notification:receive'];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  'Platform Admin': [
    'user:manage', 'user:view', 'catalogue:manage', 'catalogue:view',
    'department:manage', 'company-profile:manage', 'company-profile:view',
    'audit:view', 'notification:receive',
  ],
  'Super Admin': [
    ...ALL_VIEW, 'user:view', 'catalogue:view', 'company-profile:view',
    'engagement:create', 'engagement:update', 'engagement:transition',
    'request:create', 'request:update', 'request:assign',
    'document:upload', 'document:delete',
    'submission:review', 'discussion:participate',
    'review:decide', 'review:signoff', 'audit:view',
  ],
  Auditor: [
    ...ALL_VIEW, 'company-profile:view',
    'engagement:create', 'engagement:update', 'engagement:transition',
    'request:create', 'request:update', 'request:assign',
    'document:upload', 'submission:review', 'discussion:participate',
    'review:submit',
  ],
  Staff: [...ALL_VIEW, 'company-profile:view', 'document:upload'],
  Client: ['engagement:view', 'request:view', 'submission:respond', 'discussion:participate', 'notification:receive'],
};

export function roleHasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
