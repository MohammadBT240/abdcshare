import { Entity, Enum, PrimaryKey, Property } from '@mikro-orm/core';
import { OutboxStatus } from '@abdcshare/shared';

@Entity({ tableName: 'outbox' })
export class OutboxEntity {
  @PrimaryKey({ type: 'uuid' })
  id!: string;

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

  @Property({ type: 'timestamptz' })
  createdAt!: Date;

  @Property({ type: 'timestamptz' })
  updatedAt!: Date;
}
