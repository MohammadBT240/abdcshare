import { Module } from '@nestjs/common';
import { OpsModule } from '../modules/ops/ops.module';
import { HealthController } from './health.controller';

@Module({ imports: [OpsModule], controllers: [HealthController] })
export class HealthModule {}
