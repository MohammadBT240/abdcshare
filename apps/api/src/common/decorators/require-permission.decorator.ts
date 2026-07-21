import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@abdcshare/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
/** Guards a route: the caller's role must hold ALL listed permissions. */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
