import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { EngagementTypeEntity } from './infrastructure/persistence/engagement-type.entity';
import { RequestClassEngagementTypeEntity } from './infrastructure/persistence/request-class-engagement-type.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import { EngagementTypesService } from './engagement-types.service';
import { EngagementTypesController } from './engagement-types.controller';

@Module({
  imports: [MikroOrmModule.forFeature([EngagementTypeEntity, RequestClassEngagementTypeEntity, RequestClassEntity])],
  controllers: [EngagementTypesController],
  providers: [EngagementTypesService],
  exports: [EngagementTypesService],
})
export class EngagementTypesModule {}
