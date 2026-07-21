import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { RequestClassEntity } from './infrastructure/persistence/request-class.entity';
import { RequestClassesService } from './request-classes.service';
import { RequestClassesController } from './request-classes.controller';

@Module({
  imports: [MikroOrmModule.forFeature([RequestClassEntity])],
  controllers: [RequestClassesController],
  providers: [RequestClassesService],
  exports: [RequestClassesService],
})
export class RequestClassesModule {}
