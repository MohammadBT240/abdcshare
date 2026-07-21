import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestTypeEntity } from './infrastructure/persistence/request-type.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import { RequestTypesService } from './request-types.service';
import { RequestTypesController } from './request-types.controller';

@Module({
  imports: [MikroOrmModule.forFeature([RequestTypeEntity, RequestClassEntity])],
  controllers: [RequestTypesController],
  providers: [RequestTypesService],
  exports: [RequestTypesService],
})
export class RequestTypesModule {}
