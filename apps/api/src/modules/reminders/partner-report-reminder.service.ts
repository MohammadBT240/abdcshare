import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import { PartnerReportInviteStatus } from '@abdcshare/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerReportInviteEntity } from '../partner-reports/infrastructure/persistence/partner-report-invite.entity';

/**
 * Weekly scan that nudges invited guests who have **not yet submitted** a Chairman report
 * (their invite is still `Invited`). Runs Mondays at 08:00.
 * `@CreateRequestContext()` gives the cron a forked EM (no HTTP request in scope).
 */
@Injectable()
export class PartnerReportReminderService {
  private readonly logger = new Logger(PartnerReportReminderService.name);

  constructor(
    private readonly em: EntityManager,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * 1')
  @CreateRequestContext()
  async scan(): Promise<void> {
    const invites = await this.em.find(
      PartnerReportInviteEntity,
      { status: PartnerReportInviteStatus.Invited },
      { populate: ['guestUser'] },
    );
    let notified = 0;
    for (const invite of invites) {
      const guest = invite.guestUser;
      if (!guest) continue;
      await this.notifications.emit({
        recipients: [{ userId: guest.id, email: guest.email ?? null }],
        type: 'partner-report.reminder',
        title: 'Reminder: the Chairman is awaiting your report',
        body: 'You were invited to submit a report — please submit it when you can.',
        entityType: 'partner-report',
        link: '/partner-reports',
      });
      notified += 1;
    }
    if (notified > 0) {
      await this.em.flush();
      this.logger.log(`Report reminders sent to ${notified} guest(s) with outstanding invites.`);
    }
  }
}
