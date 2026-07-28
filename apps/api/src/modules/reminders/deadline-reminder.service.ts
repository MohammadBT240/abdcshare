import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily scan that nudges assignees about requests **due within the next 24h**.
 * `@CreateRequestContext()` gives the cron a forked EM (no HTTP request in scope).
 */
@Injectable()
export class DeadlineReminderService {
  private readonly logger = new Logger(DeadlineReminderService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  @CreateRequestContext()
  async scan(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + DAY_MS);
    const requests = await this.em.find(
      RequestEntity,
      { dueDate: { $gte: now, $lte: soon } } as FilterQuery<RequestEntity>,
      { populate: ['assignees.user'] },
    );
    let notified = 0;
    for (const r of requests) {
      const recipients = r.assignees
        .getItems()
        .map((a) => ({ userId: a.user.id, email: a.user.email ?? null }));
      if (recipients.length === 0) continue;
      await this.notifications.emit({
        recipients,
        type: 'request.deadline',
        title: 'A request is due soon',
        body: r.description.slice(0, 140),
        entityType: 'request',
        entityId: r.id,
        link: `/requests/${r.id}`,
      });
      notified += 1;
    }
    if (notified > 0) {
      await this.em.flush();
      this.logger.log(`Deadline reminders sent for ${notified} request(s).`);
    }
  }
}
