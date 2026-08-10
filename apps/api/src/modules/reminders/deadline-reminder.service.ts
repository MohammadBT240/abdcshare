import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { isRequestDone, isRequestOverdue, startOfLocalDay } from '@abdcshare/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { assigneesOrTeamRecipients } from '../notifications/recipient-helpers';
import { RequestEntity } from '../requests/infrastructure/persistence/request.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily scan: due-soon (next 24h) and overdue assignee/team/creator reminders.
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
    const startOfToday = startOfLocalDay(now);

    const dueSoon = await this.em.find(
      RequestEntity,
      { dueDate: { $gte: now, $lte: soon } } as FilterQuery<RequestEntity>,
      { populate: ['assignees.user', 'status', 'engagement'] },
    );
    // Broad fetch: due before today; done statuses filtered in-memory via shared helper.
    const overdueCandidates = await this.em.find(
      RequestEntity,
      { dueDate: { $lt: startOfToday } } as FilterQuery<RequestEntity>,
      { populate: ['assignees.user', 'status', 'engagement'] },
    );

    let notified = 0;
    for (const r of dueSoon) {
      if (isRequestDone(r.status?.name)) continue;
      const recipients = await assigneesOrTeamRecipients(this.em, {
        requestId: r.id,
        engagementId: r.engagement.id,
      });
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

    for (const r of overdueCandidates) {
      if (!isRequestOverdue(r.dueDate, r.status?.name, now)) continue;
      const recipients = await assigneesOrTeamRecipients(this.em, {
        requestId: r.id,
        engagementId: r.engagement.id,
      });
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

    this.logger.log(`Deadline scan notified ${notified} recipient groups`);
  }
}
