import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntityManager } from '@mikro-orm/postgresql';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { OutboxStatus, QUEUE, type NotificationJob } from '@abdcshare/shared';
import { OUTBOX_REDIS } from './outbox.tokens';
import { OutboxEntity } from './infrastructure/persistence/outbox.entity';

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private queue: Queue<NotificationJob> | null = null;

  constructor(
    private readonly em: EntityManager,
    @Optional() @Inject(OUTBOX_REDIS) private readonly redis: Redis | null,
  ) {}

  onModuleInit(): void {
    if (!this.redis) {
      this.logger.warn('REDIS_URL not set — outbox publisher disabled (rows stay pending).');
      return;
    }
    this.queue = new Queue(QUEUE.Notifications, { connection: this.redis });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  /** Drains pending outbox rows to BullMQ. jobId = outbox id for idempotency. */
  @Cron(CronExpression.EVERY_10_SECONDS)
  async drain(): Promise<void> {
    if (!this.queue) return;
    const em = this.em.fork();
    const pending = await em.find(OutboxEntity, { status: OutboxStatus.Pending }, { limit: 50, orderBy: { createdAt: 'asc' } });
    for (const row of pending) {
      await this.queue.add(
        row.eventType,
        { outboxId: row.id, eventType: row.eventType, payload: row.payload },
        { jobId: row.id, removeOnComplete: true, attempts: 5, backoff: { type: 'exponential', delay: 2000 } },
      );
      row.status = OutboxStatus.Queued;
    }
    if (pending.length) {
      await em.flush();
      this.logger.log(`Queued ${pending.length} outbox row(s).`);
    }
  }
}
