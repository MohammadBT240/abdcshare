import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestEntity } from './infrastructure/persistence/request.entity';
import { RequestAssigneeEntity } from './infrastructure/persistence/request-assignee.entity';
import { RequestHistoryEntity } from './infrastructure/persistence/request-history.entity';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';

@Module({
  imports: [
    MikroOrmModule.forFeature([RequestEntity, RequestAssigneeEntity, RequestHistoryEntity]),
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
