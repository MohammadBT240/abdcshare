import { Entity, ManyToOne, OptionalProps, PrimaryKeyProp, Property } from '@mikro-orm/core';
import { EngagementEntity } from './engagement.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/**
 * Client-org contacts assigned to an engagement.
 * Visibility for Client-role users is membership here (not all client engagements).
 */
@Entity({ tableName: 'engagement_client_contacts' })
export class EngagementClientContactEntity {
  [OptionalProps]?: 'assignedAt' | 'isMain' | 'receiveEmail';

  @ManyToOne(() => EngagementEntity, { primary: true, deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => UserEntity, { primary: true })
  user!: UserEntity;

  /** Exactly one main contact per engagement (enforced in app + partial unique index). */
  @Property({ default: false })
  isMain: boolean = false;

  /** When true, engagement notifications include the email channel for this contact. */
  @Property({ default: false })
  receiveEmail: boolean = false;

  @ManyToOne(() => UserEntity, { nullable: true })
  assignedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  assignedAt: Date = new Date();

  [PrimaryKeyProp]?: ['engagement', 'user'];
}
