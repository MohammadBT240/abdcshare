import { Entity, Enum, Index, Property } from '@mikro-orm/core';
import { OutboxStatus } from '@abdcshare/shared';
import { BaseEntity } from '../../../../database/base.entity';

@Entity({ tableName: 'outbox' })
@Index({ properties: ['status', 'createdAt'] })
export class OutboxEntity extends BaseEntity {
  @Property()
  eventType!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Enum(() => OutboxStatus)
  status: OutboxStatus = OutboxStatus.Pending;

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  lastError?: string | null;
}
