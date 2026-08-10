import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PartnerReportEntity } from './infrastructure/persistence/partner-report.entity';
import { PartnerReportInviteEntity } from './infrastructure/persistence/partner-report-invite.entity';
import { PartnerReportEngagementUpdateEntity } from './infrastructure/persistence/partner-report-engagement-update.entity';
import { PartnerReportDecisionEntity } from './infrastructure/persistence/partner-report-decision.entity';
import { PartnerReportBillingItemEntity } from './infrastructure/persistence/partner-report-billing-item.entity';
import { PartnerReportReporterEntity } from './infrastructure/persistence/partner-report-reporter.entity';
import { PartnerReportAccessService } from './partner-report-access.service';
import { PartnerReportsService } from './partner-reports.service';
import { PartnerReportsController } from './partner-reports.controller';

/** Global so PermissionsGuard can resolve PartnerReportAccessService. */
@Global()
@Module({
  imports: [
    MikroOrmModule.forFeature([
      PartnerReportEntity,
      PartnerReportInviteEntity,
      PartnerReportEngagementUpdateEntity,
      PartnerReportDecisionEntity,
      PartnerReportBillingItemEntity,
      PartnerReportReporterEntity,
    ]),
  ],
  controllers: [PartnerReportsController],
  providers: [PartnerReportsService, PartnerReportAccessService],
  exports: [PartnerReportsService, PartnerReportAccessService],
})
export class PartnerReportsModule {}

