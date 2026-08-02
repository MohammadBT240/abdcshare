import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  EngagementMemberRole,
  hasPermission,
  type Permission,
} from '@abdcshare/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';

export type EngagementCapability = 'manage' | 'transition' | 'signoff';

const CAPABILITY_PERMISSION: Record<EngagementCapability, Permission> = {
  manage: 'engagement:update',
  transition: 'engagement:transition',
  signoff: 'review:signoff',
};

export async function isEngagementLead(
  em: EntityManager,
  engagementId: string,
  userId: string,
): Promise<boolean> {
  const row = await em.findOne(EngagementTeamMemberEntity, {
    engagement: engagementId,
    user: userId,
    memberRole: EngagementMemberRole.Lead,
  });
  return row != null;
}

export async function hasEngagementCapability(
  em: EntityManager,
  user: AuthenticatedUser,
  engagementId: string,
  capability: EngagementCapability,
): Promise<boolean> {
  if (
    hasPermission(
      user.role,
      CAPABILITY_PERMISSION[capability],
      user.partnerDesignation,
    )
  ) {
    return true;
  }
  return isEngagementLead(em, engagementId, user.userId);
}

/** Allow Super Admin (global perm) or the engagement Lead. */
export async function assertEngagementCapability(
  em: EntityManager,
  user: AuthenticatedUser,
  engagementId: string,
  capability: EngagementCapability,
): Promise<void> {
  if (await hasEngagementCapability(em, user, engagementId, capability)) return;
  throw new ForbiddenException(
    `Requires engagement Lead or ${CAPABILITY_PERMISSION[capability]} permission`,
  );
}
