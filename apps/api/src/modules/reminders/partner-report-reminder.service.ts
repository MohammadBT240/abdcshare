import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreateRequestContext, EntityManager } from '@mikro-orm/postgresql';
import { PartnerReportCadence, PartnerReportInviteStatus, PartnerReportStatus } from '@abdcshare/shared';
import { NotificationsService } from '../notifications/notifications.service';
import { PartnerReportInviteEntity } from '../partner-reports/infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportReporterEntity } from '../partner-reports/infrastructure/persistence/partner-report-reporter.entity';
import { PartnerReportEntity } from '../partner-reports/infrastructure/persistence/partner-report.entity';

/**
 * Soft weekly nudges (Mondays 08:00):
 * - Guests still Invited
 * - Roster members with reminders on + (open request OR due for cadence)
 * Never blocks submit — informational only.
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
    let notified = 0;

    const invites = await this.em.find(
      PartnerReportInviteEntity,
      { status: PartnerReportInviteStatus.Invited },
      { populate: ['guestUser'] },
    );
    for (const invite of invites) {
      const guest = invite.guestUser;
      if (!guest?.isActive) continue;
      await this.notifications.emit({
        recipients: [{ userId: guest.id, email: guest.email ?? null }],
        type: 'partner-report.reminder',
        title: 'Reminder: the Principal is awaiting your report',
        body: 'You were invited to submit a report — please submit it when you can.',
        entityType: 'partner-report',
        link: '/reports',
      });
      notified += 1;
    }

    const weekStart = this.mondayStart(new Date());
    const roster = await this.em.find(
      PartnerReportReporterEntity,
      { remindersEnabled: true },
      { populate: ['user'] },
    );
    for (const row of roster) {
      if (!row.user?.isActive) continue;
      const due =
        row.reportRequestedAt != null ||
        (row.cadence !== PartnerReportCadence.None &&
          !(await this.submittedSince(row.user.id, this.periodStart(row.cadence, weekStart))));
      if (!due) continue;
      await this.notifications.emit({
        recipients: [{ userId: row.user.id, email: row.user.email ?? null }],
        type: 'partner-report.reminder',
        title: row.reportRequestedAt
          ? 'Reminder: report still requested by the Principal'
          : 'Gentle reminder: your partner report cadence',
        body: 'You can submit anytime — cadence is a preference, not a hard deadline.',
        entityType: 'partner-report',
        link: '/reports',
      });
      row.lastRemindedAt = new Date();
      notified += 1;
    }

    if (notified > 0) {
      await this.em.flush();
      this.logger.log(`Partner report reminders sent to ${notified} recipient(s).`);
    }
  }

  private mondayStart(now: Date): Date {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - diff);
    return d;
  }

  private periodStart(cadence: PartnerReportCadence, weekStart: Date): Date {
    if (cadence === PartnerReportCadence.Weekly) return weekStart;
    const d = new Date();
    if (cadence === PartnerReportCadence.Monthly) return new Date(d.getFullYear(), d.getMonth(), 1);
    const q = Math.floor(d.getMonth() / 3) * 3;
    return new Date(d.getFullYear(), q, 1);
  }

  private async submittedSince(userId: string, since: Date): Promise<boolean> {
    const count = await this.em.count(PartnerReportEntity, {
      submittedBy: userId,
      status: { $in: [PartnerReportStatus.Submitted, PartnerReportStatus.Reviewed] },
      submittedAt: { $gte: since },
    });
    return count > 0;
  }
}
