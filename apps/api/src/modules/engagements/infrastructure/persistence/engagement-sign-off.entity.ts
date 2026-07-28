import { Entity, ManyToOne, Property } from '@mikro-orm/core';
import { BaseEntity } from '../../../../database/base.entity';
import { EngagementEntity } from './engagement.entity';
import { RequestClassEntity } from '../../../request-classes/infrastructure/persistence/request-class.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/**
 * A sign-off on an engagement. `requestClass = null` is an engagement-wide
 * sign-off; otherwise it covers one request class. Revocable.
 */
@Entity({ tableName: 'engagement_sign_offs' })
export class EngagementSignOffEntity extends BaseEntity {
  @ManyToOne(() => EngagementEntity, { deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @ManyToOne(() => RequestClassEntity, { nullable: true })
  requestClass?: RequestClassEntity | null;

  @ManyToOne(() => UserEntity)
  signedBy!: UserEntity;

  @Property({ type: 'timestamptz' })
  signedAt: Date = new Date();

  @Property({ type: 'text', nullable: true })
  note?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  revokedBy?: UserEntity | null;

  @Property({ type: 'timestamptz', nullable: true })
  revokedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  revokeReason?: string | null;
}
