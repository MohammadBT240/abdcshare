import { Entity, Enum, ManyToOne, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { EngagementStage } from '@abdcshare/shared';
import { EngagementEntity } from './engagement.entity';
import { UserEntity } from '../../../users/infrastructure/persistence/user.entity';

/** Append-only audit of engagement stage transitions. */
@Entity({ tableName: 'engagement_status_history' })
export class EngagementStageHistoryEntity {
  [OptionalProps]?: 'id' | 'changedAt';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @ManyToOne(() => EngagementEntity, { deleteRule: 'cascade' })
  engagement!: EngagementEntity;

  @Enum({ items: () => EngagementStage, nullable: true, fieldName: 'from_stage' })
  fromStage?: EngagementStage | null;

  @Enum({ items: () => EngagementStage, fieldName: 'to_stage' })
  toStage!: EngagementStage;

  @ManyToOne(() => UserEntity, { nullable: true })
  changedBy?: UserEntity | null;

  @Property({ type: 'timestamptz' })
  changedAt: Date = new Date();

  @Property({ type: 'text', nullable: true })
  note?: string | null;
}
