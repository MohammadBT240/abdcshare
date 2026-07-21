import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { EngagementStatus } from '@abdcshare/shared';
import { EngagementEntity } from './engagement.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Append-only audit of engagement status transitions. */
@Entity({ tableName: 'engagement_status_history' })
export class EngagementStatusHistoryEntity {
  [OptionalProps]?: 'id' | 'changedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => EngagementEntity, { deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @Enum({ items: () => EngagementStatus, nullable: true })
  fromStatus?: EngagementStatus | null;

  @Enum({ items: () => EngagementStatus })
  toStatus!: EngagementStatus;

  @ManyToOne(() => UserEntity, { nullable: true })
  changedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  changedAt: Date = new Date();

  @Property({ type: 'text', nullable: true })
  note?: string | null;
}
