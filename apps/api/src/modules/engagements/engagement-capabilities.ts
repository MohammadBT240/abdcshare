import { ForbiddenException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import {
  EngagementMemberRole,
  hasPermission,
  type Permission,
} from '@abdcshare/shared';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
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

/**
 * - manage / signoff: global permission OR engagement Lead
 * - transition: Super Admin (`engagement:transition`) who **created** this engagement only
 */
export async function hasEngagementCapability(
  em: EntityManager,
  user: AuthenticatedUser,
  engagementId: string,
  capability: EngagementCapability,
): Promise<boolean> {
  if (capability === 'transition') {
    if (
      !hasPermission(
        user.role,
        CAPABILITY_PERMISSION.transition,
        user.partnerDesignation,
      )
    ) {
      return false;
    }
    const engagement = await em.findOne(
      EngagementEntity,
      { id: engagementId },
      { populate: ['createdBy'] },
    );
    return engagement?.createdBy?.id === user.userId;
  }

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

/** Allow Super Admin (global perm) or the engagement Lead — except transitions (creator only). */
export async function assertEngagementCapability(
  em: EntityManager,
  user: AuthenticatedUser,
  engagementId: string,
  capability: EngagementCapability,
): Promise<void> {
  if (await hasEngagementCapability(em, user, engagementId, capability)) return;
  if (capability === 'transition') {
    throw new ForbiddenException(
      'Only the Super Admin who created this engagement can advance its stage',
    );
  }
  throw new ForbiddenException(
    `Requires engagement Lead or ${CAPABILITY_PERMISSION[capability]} permission`,
  );
}
