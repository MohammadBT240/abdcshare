import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import { LibraryItemStatus } from '@abdcshare/shared';
import { LibraryItemEntity } from './infrastructure/persistence/library-item.entity';

const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Removes abandoned Draft library items (upload never confirmed) older than 24h.
 * Drafts never carry a storage key; orphaned R2 uploads are handled by the bucket lifecycle.
 * Department links go with the row (FK on delete cascade).
 */
@Injectable()
export class LibraryDraftSweepService {
  private readonly logger = new Logger(LibraryDraftSweepService.name);

  constructor(private readonly em: EntityManager) {}

  @Cron(CronExpression.EVERY_HOUR)
  @CreateRequestContext()
  async sweep(): Promise<void> {
    const cutoff = new Date(Date.now() - DRAFT_MAX_AGE_MS);
    const removed = await this.em.nativeDelete(LibraryItemEntity, {
      status: LibraryItemStatus.Draft,
      createdAt: { $lt: cutoff },
    });
    if (removed > 0) this.logger.log(`Removed ${removed} abandoned library draft(s)`);
  }
}
