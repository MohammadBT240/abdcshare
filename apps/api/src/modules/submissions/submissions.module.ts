import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ClientSubmissionEntity } from './infrastructure/persistence/client-submission.entity';
import { SubmissionFileEntity } from './infrastructure/persistence/submission-file.entity';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';

@Module({
  imports: [MikroOrmModule.forFeature([ClientSubmissionEntity, SubmissionFileEntity])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
