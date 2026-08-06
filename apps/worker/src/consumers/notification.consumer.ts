import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityManager, MikroORM } from '@mikro-orm/postgresql';
import { Job, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { EVENT, OutboxStatus, QUEUE, type NotificationJob } from '@abdcshare/shared';
import { OutboxEntity } from '../database/outbox.entity';
import { EmailDispatchService } from '../email/email-dispatch.service';
import { DocumentExportService } from '../documents/document-export.service';
import { FilePreviewService } from '../documents/file-preview.service';
import { SubmissionExportService } from '../documents/submission-export.service';
import {
  AccountCreatedEmail,
  GenericNotificationEmail,
  PasswordChangedEmail,
  PasswordResetEmail,
} from '../email/templates';

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
    private readonly documentExports: DocumentExportService,
    private readonly filePreviews: FilePreviewService,
    private readonly submissionExports: SubmissionExportService,
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
    const { outboxId, eventType, payload } = job.data;
    const em = this.orm.em.fork();
    const row = await em.findOne(OutboxEntity, { id: outboxId });
    if (!row || row.status === OutboxStatus.Sent) return; // idempotent
    try {
      this.logger.log(`Processing ${eventType} (outbox ${outboxId})`);
      await this.dispatch(eventType, payload, em);
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

  /** Turn a domain event into its email side effect(s). */
  private async dispatch(
    eventType: string,
    payload: Record<string, unknown>,
    em: EntityManager,
  ): Promise<void> {
    switch (eventType) {
      case EVENT.UserCreated: {
        const email = typeof payload.email === 'string' ? payload.email : null;
        const tempPassword = typeof payload.tempPassword === 'string' ? payload.tempPassword : '';
        if (email) {
          const base = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000').replace(/\/+$/, '');
          const link = `${base}/login?email=${encodeURIComponent(email)}`;
          await this.email.sendReact(
            email,
            'Your ABDC Share account',
            AccountCreatedEmail({ email, tempPassword, loginUrl: link }),
          );
        }
        break;
      }
      case EVENT.PasswordResetRequested: {
        const email = typeof payload.email === 'string' ? payload.email : null;
        const token = typeof payload.token === 'string' ? payload.token : '';
        if (email) {
          const base = this.config.get<string>('WEB_APP_URL', 'http://localhost:3000').replace(/\/+$/, '');
          const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;
          await this.email.sendReact(
            email,
            'Reset your ABDC Share password',
            PasswordResetEmail({ resetUrl: link }),
          );
        }
        break;
      }
      case EVENT.PasswordChanged: {
        const email = typeof payload.email === 'string' ? payload.email : null;
        if (email) {
          await this.email.sendReact(
            email,
            'Your ABDC Share password was changed',
            PasswordChangedEmail(),
          );
        }
        break;
      }
      case EVENT.NotificationEmail: {
        const emails = Array.isArray(payload.emails)
          ? (payload.emails as Array<{
              notificationId?: string;
              to: string;
              subject: string;
              body?: string;
              link?: string;
              html?: string;
            }>)
          : [];
        for (const e of emails) {
          if (!e?.to) continue;
          const body = e.body ?? e.html ?? e.subject;
          await this.email.sendReact(
            e.to,
            e.subject,
            GenericNotificationEmail({ title: e.subject, body, link: e.link }),
          );
          if (e.notificationId) {
            await em
              .getConnection()
              .execute('update "notifications" set email_sent = true, email_sent_at = now() where id = ?', [
                e.notificationId,
              ]);
          }
        }
        break;
      }
      case EVENT.DocumentExportRequested:
        await this.documentExports.export(payload, em);
        break;
      case EVENT.SubmissionExportRequested:
        await this.submissionExports.export(payload, em);
        break;
      case EVENT.FilePreviewRequested:
        await this.filePreviews.generate(payload, em);
        break;
      default:
        // No email side effect for this event type — just sealed as Sent.
        break;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
