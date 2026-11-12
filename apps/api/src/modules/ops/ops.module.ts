import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

/** Operations (S4): background-job page + the ops health check. Uses the global outbox Redis. */
@Module({
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class OpsModule {}
