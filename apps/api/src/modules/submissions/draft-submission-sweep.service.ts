import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import { SubmissionStatus } from '@abdcshare/shared';
import { ClientSubmissionEntity } from './infrastructure/persistence/client-submission.entity';

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes abandoned Draft submissions older than 24h (failed/cancelled uploads).
 * File rows cascade via FK; orphaned R2 multipart uploads are cleaned by bucket lifecycle.
 */
@Injectable()
export class DraftSubmissionSweepService {
  private readonly logger = new Logger(DraftSubmissionSweepService.name);

  constructor(private readonly em: EntityManager) {}

  @Cron(CronExpression.EVERY_HOUR)
  @CreateRequestContext()
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - DRAFT_MAX_AGE_MS);
    const stale = await this.em.find(ClientSubmissionEntity, {
      status: SubmissionStatus.Draft,
      createdAt: { $lt: cutoff },
    });
    if (stale.length === 0) return;
    for (const row of stale) {
      this.em.remove(row);
    }
    await this.em.flush();
    this.logger.log(`Removed ${stale.length} abandoned draft submission(s)`);
  }
}
