import type { PartnerDesignation, RoleName } from '@abdcshare/shared';

/** Shape attached to the request by JwtAuthGuard (from the access-token payload). */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: RoleName;
  partnerDesignation?: PartnerDesignation | null;
  /** Set only for `Client`-role contacts — the client org they belong to (row-level scope). */
  clientId?: string | null;
  mustChangePassword: boolean;
}
