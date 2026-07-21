import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestStatusEntity } from './infrastructure/persistence/request-status.entity';
import { RequestStatusesService } from './request-statuses.service';
import { RequestStatusesController } from './request-statuses.controller';

@Module({
  imports: [MikroOrmModule.forFeature([RequestStatusEntity])],
  controllers: [RequestStatusesController],
  providers: [RequestStatusesService],
  exports: [RequestStatusesService],
})
export class RequestStatusesModule {}
