import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ActivityLogEntity } from './infrastructure/persistence/activity-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';

// Global so the AuditInterceptor (registered in AppModule) can resolve AuditService.
@Global()
@Module({
  imports: [MikroOrmModule.forFeature([ActivityLogEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
