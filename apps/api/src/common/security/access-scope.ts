import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

const CLIENT_ROLE = 'Client';
const STAFF_ROLE = 'Staff';

/**
 * Row-level visibility for a user:
 * - `all`    — Platform Admin / Super Admin (and internal, user-less calls): see everything.
 * - `client` — a Client contact: only engagements they are assigned to (clientContacts).
 * - `staff`  — a Staff member: only engagements they're on the team of (+ their requests).
 */
export type AccessScope =
  | { kind: 'all' }
  | { kind: 'client'; clientId: string; userId: string }
  | { kind: 'staff'; userId: string };

type ScopeUser = Pick<AuthenticatedUser, 'role' | 'clientId' | 'userId'>;

export function resolveScope(user?: ScopeUser | null): AccessScope {
  if (!user) return { kind: 'all' };
  if (user.role === CLIENT_ROLE) {
    if (!user.clientId) {
      throw new ForbiddenException('This client account is not linked to a client organisation');
    }
    return { kind: 'client', clientId: user.clientId, userId: user.userId };
  }
  if (user.role === STAFF_ROLE) return { kind: 'staff', userId: user.userId };
  return { kind: 'all' };
}

/**
 * The single scoping primitive: a `where` fragment applied to an **engagement**
 * (directly, or nested under `engagement`/`request.engagement`).
 * - `all`    → `{}` (no restriction)
 * - `client` → `{ clientContacts: { user: <id> } }` (assigned contact membership)
 * - `staff`  → `{ team: { user: <id> } }` (team membership)
 */
export function engagementScopeWhere(scope: AccessScope): Record<string, unknown> {
  switch (scope.kind) {
    case 'client':
      return { clientContacts: { user: scope.userId } };
    case 'staff':
      return { team: { user: scope.userId } };
    default:
      return {};
  }
}

/** True when the scope restricts rows (client/staff) vs. sees-everything (all). */
export function isScoped(scope: AccessScope): boolean {
  return scope.kind !== 'all';
}
