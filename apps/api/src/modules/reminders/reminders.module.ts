import { Module } from '@nestjs/common';
import { DeadlineReminderService } from './deadline-reminder.service';
import { PartnerReportReminderService } from './partner-report-reminder.service';

// ScheduleModule.forRoot() is registered in AppModule; NotificationsService is global.
@Module({
  providers: [DeadlineReminderService, PartnerReportReminderService],
})
export class RemindersModule {}
