import { Module } from '@nestjs/common';
import { SearchService } from './search.service';
import { DashboardService } from './dashboard.service';
import { InsightsController } from './insights.controller';

// Uses the global EntityManager to query already-registered entities — no forFeature needed.
@Module({
  controllers: [InsightsController],
  providers: [SearchService, DashboardService],
})
export class InsightsModule {}
