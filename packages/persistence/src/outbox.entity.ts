import { Entity, Enum, Index, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';
import { randomUUID } from 'node:crypto';
import { OutboxStatus } from '@abdcshare/shared';

/**
 * Transactional outbox (ARCHITECTURE §8). The API writes rows in the same flush as the change;
 * the publisher queues them; the worker seals `status`. One definition for both apps (S4).
 */
@Entity({ tableName: 'outbox' })
@Index({ properties: ['status', 'createdAt'] })
export class OutboxEntity {
  [OptionalProps]?: 'id' | 'createdAt' | 'updatedAt' | 'status';

  @PrimaryKey({ type: 'uuid' })
  id: string = randomUUID();

  @Property({ type: 'timestamptz' })
  createdAt: Date = new Date();

  @Property({ type: 'timestamptz', onUpdate: () => new Date() })
  updatedAt: Date = new Date();

  @Property({ type: 'string' })
  eventType!: string;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Enum({ items: () => OutboxStatus })
  status: OutboxStatus = OutboxStatus.Pending;

  @Property({ type: 'timestamptz', nullable: true })
  processedAt?: Date | null;

  @Property({ type: 'text', nullable: true })
  lastError?: string | null;
}
