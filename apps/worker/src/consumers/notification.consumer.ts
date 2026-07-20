import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroORM } from '@mikro-orm/postgresql';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { OutboxStatus, QUEUE, type NotificationJob } from '@abdcshare/shared';
import { OutboxEntity } from '../database/outbox.entity';
import { EmailDispatchService } from '../email/email-dispatch.service';

/**
 * Consumes the notifications queue, does the side effect (email / in-app fan-out),
 * then seals the outbox row status directly in the shared DB. Idempotent per outboxId.
 */
@Injectable()
export class NotificationConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationConsumer.name);
  private worker: Worker<NotificationJob> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly orm: MikroORM,
    private readonly email: EmailDispatchService,
  ) {}

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — notification consumer disabled.');
      return;
    }
    const connection = new IORedis(url, { maxRetriesPerRequest: null });
    this.worker = new Worker<NotificationJob>(
      QUEUE.Notifications,
      (job) => this.handle(job),
      { connection },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`job ${job?.id} failed: ${err.message}`));
    this.logger.log('Notification consumer started.');
  }

  private async handle(job: Job<NotificationJob>): Promise<void> {
    const { outboxId, eventType } = job.data;
    const em = this.orm.em.fork();
    const row = await em.findOne(OutboxEntity, { id: outboxId });
    if (!row || row.status === OutboxStatus.Sent) return; // idempotent
    try {
      this.logger.log(`Processing ${eventType} (outbox ${outboxId})`);
      // TODO(phase-1): render + send real email / write notifications from payload.
      row.status = OutboxStatus.Sent;
      row.processedAt = new Date();
    } catch (err) {
      row.status = OutboxStatus.Failed;
      row.lastError = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      row.updatedAt = new Date();
      await em.flush();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
