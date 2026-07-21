import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestStageEntity } from './infrastructure/persistence/request-stage.entity';
import { RequestStagesService } from './request-stages.service';
import { RequestStagesController } from './request-stages.controller';

@Module({
  imports: [MikroOrmModule.forFeature([RequestStageEntity])],
  controllers: [RequestStagesController],
  providers: [RequestStagesService],
  exports: [RequestStagesService],
})
export class RequestStagesModule {}
