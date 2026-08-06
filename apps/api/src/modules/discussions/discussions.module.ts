import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { DiscussionMessageEntity } from './infrastructure/persistence/discussion-message.entity';
import { DiscussionMentionEntity } from './infrastructure/persistence/discussion-mention.entity';
import { DiscussionReadEntity } from './infrastructure/persistence/discussion-read.entity';
import { DiscussionAttachmentEntity } from './infrastructure/persistence/discussion-attachment.entity';
import { DiscussionFileReferenceEntity } from './infrastructure/persistence/discussion-file-reference.entity';
import { DiscussionsService } from './discussions.service';
import { DiscussionsController } from './discussions.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      DiscussionMessageEntity,
      DiscussionMentionEntity,
      DiscussionReadEntity,
      DiscussionAttachmentEntity,
      DiscussionFileReferenceEntity,
    ]),
  ],
  controllers: [DiscussionsController],
  providers: [DiscussionsService],
  exports: [DiscussionsService],
})
export class DiscussionsModule {}
