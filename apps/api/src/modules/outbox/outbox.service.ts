import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { OutboxStatus } from '@abdcshare/shared';
import { OutboxEntity } from './infrastructure/persistence/outbox.entity';

/**
 * Durable transactional outbox. `enqueue` MUST be called inside the same
 * unit of work as the domain change, so events are never lost or orphaned.
 */
@Injectable()
export class OutboxService {
  constructor(private readonly em: EntityManager) {}

  enqueue(eventType: string, payload: Record<string, unknown>): OutboxEntity {
    const row = this.em.create(OutboxEntity, {
      eventType,
      payload,
      status: OutboxStatus.Pending,
    });
    this.em.persist(row);
    return row;
  }
}
