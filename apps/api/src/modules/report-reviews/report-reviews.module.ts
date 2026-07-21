import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ReportReviewCycleEntity } from './infrastructure/persistence/report-review-cycle.entity';
import { ReportReviewsService } from './report-reviews.service';
import {
  FinalReportReviewClientController,
  FinalReportReviewFirmController,
} from './report-reviews.controller';

@Module({
  imports: [MikroOrmModule.forFeature([ReportReviewCycleEntity])],
  controllers: [FinalReportReviewFirmController, FinalReportReviewClientController],
  providers: [ReportReviewsService],
  exports: [ReportReviewsService],
})
export class ReportReviewsModule {}
