import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PartnerReportEntity } from './infrastructure/persistence/partner-report.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportEngagementUpdateEntity } from './infrastructure/persistence/partner-report-engagement-update.entity';
import { PartnerReportDecisionEntity } from './infrastructure/persistence/partner-report-decision.entity';
import { PartnerReportsService } from './partner-reports.service';
import { PartnerReportsController } from './partner-reports.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      PartnerReportEntity,
      PartnerReportInviteEntity,
      PartnerReportEngagementUpdateEntity,
      PartnerReportDecisionEntity,
    ]),
  ],
  controllers: [PartnerReportsController],
  providers: [PartnerReportsService],
  exports: [PartnerReportsService],
})
export class PartnerReportsModule {}
