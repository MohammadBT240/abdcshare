import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@abdcshare/shared';

export const PERMISSIONS_KEY = 'requiredPermissions';
export const ANY_PERMISSIONS_KEY = 'requiredAnyPermissions';

/** Guards a route: the caller's role must hold ALL listed permissions. */
export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/** Guards a route: the caller's role must hold AT LEAST ONE listed permission. */
export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
