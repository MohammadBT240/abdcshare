import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { EngagementMemberRole } from '@abdcshare/shared';
import { EngagementEntity } from './engagement.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** People on an engagement team — may come from any department. */
@Entity({ tableName: 'engagement_team_members' })
export class EngagementTeamMemberEntity {
  [OptionalProps]?: 'assignedAt';

  @ManyToOne(() => EngagementEntity, { primary: true, deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  user!: UserEntity;

  @Enum({ items: () => EngagementMemberRole })
  memberRole!: EngagementMemberRole;

  @ManyToOne(() => UserEntity, { nullable: true })
  assignedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  assignedAt: Date = new Date();

  [PrimaryKeyProp]?: ['engagement', 'user'];
}
