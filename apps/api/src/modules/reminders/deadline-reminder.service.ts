import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE_STATUS_NAMES = new Set(['Accepted', 'Closed']);

/**
 * Daily scan: due-soon (next 24h) and overdue assignee reminders.
 * `@CreateRequestContext()` gives the cron a forked EM (no HTTP request in scope).
 */
@Injectable()
export class DeadlineReminderService {
  private readonly logger = new Logger(DeadlineReminderService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
  ) {}

  private isDone(statusName: string | null | undefined): boolean {
    return statusName != null && DONE_STATUS_NAMES.has(statusName);
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  @CreateRequestContext()
  async scan(): Promise<void> {
    const now = new Date();
    const soon = new Date(now.getTime() + DAY_MS);

    const dueSoon = await this.em.find(
      RequestEntity,
      { dueDate: { $gte: now, $lte: soon } } as FilterQuery<RequestEntity>,
      { populate: ['assignees.user', 'status'] },
    );
    const overdue = await this.em.find(
      RequestEntity,
      { dueDate: { $lt: now } } as FilterQuery<RequestEntity>,
      { populate: ['assignees.user', 'status'] },
    );

    let notified = 0;
    for (const r of dueSoon) {
      if (this.isDone(r.status?.name)) continue;
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

    for (const r of overdue) {
      if (this.isDone(r.status?.name)) continue;
      const recipients = r.assignees
        .getItems()
        .map((a) => ({ userId: a.user.id, email: a.user.email ?? null }));
      if (recipients.length === 0) continue;
      await this.notifications.emit({
        recipients,
        type: 'request.overdue',
        title: 'A request is overdue',
        body: r.description.slice(0, 140),
        entityType: 'request',
        entityId: r.id,
        link: `/requests/${r.id}`,
      });
      notified += 1;
    }

    if (notified > 0) {
      await this.em.flush();
      this.logger.log(`Deadline/overdue reminders sent for ${notified} request(s).`);
    }
  }
}
