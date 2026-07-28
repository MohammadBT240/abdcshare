import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EngagementEntity } from './infrastructure/persistence/engagement.entity';
import { EngagementTeamMemberEntity } from './infrastructure/persistence/engagement-team-member.entity';
import { EngagementRequestClassEntity } from './infrastructure/persistence/engagement-request-class.entity';
import { EngagementStatusHistoryEntity } from './infrastructure/persistence/engagement-status-history.entity';
import { EngagementSignOffEntity } from './infrastructure/persistence/engagement-sign-off.entity';
import { EngagementsService } from './engagements.service';
import { EngagementsController } from './engagements.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      EngagementEntity,
      EngagementTeamMemberEntity,
      EngagementRequestClassEntity,
      EngagementStatusHistoryEntity,
      EngagementSignOffEntity,
    ]),
  ],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
