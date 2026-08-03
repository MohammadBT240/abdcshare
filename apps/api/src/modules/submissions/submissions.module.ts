import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ClientSubmissionEntity } from './infrastructure/persistence/client-submission.entity';
import { SubmissionFileEntity } from './infrastructure/persistence/submission-file.entity';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { DraftSubmissionSweepService } from './draft-submission-sweep.service';

@Module({
  imports: [MikroOrmModule.forFeature([ClientSubmissionEntity, SubmissionFileEntity])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, DraftSubmissionSweepService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
