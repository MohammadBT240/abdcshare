import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementStageHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';
import { EngagementSignOffEntity } from './infrastructure/persistence/engagement-sign-off.entity';
import { EngagementsService } from './engagements.service';
import { EngagementsController } from './engagements.controller';

@Module({
  imports: [
    // OutboxService is provided by the global OutboxModule (see clients.module pattern).
    MikroOrmModule.forFeature([
      EngagementEntity,
      EngagementTeamMemberEntity,
      EngagementRequestClassEntity,
      EngagementStageHistoryEntity,
      EngagementSignOffEntity,
    ]),
  ],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
