import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { validateEnv } from './config/env.schema';
import mikroOrmConfig from './database/mikro-orm.config';
import { EmailDispatchService } from './email/email-dispatch.service';
import { NotificationConsumer } from './consumers/notification.consumer';
import { DocumentExportService } from './documents/document-export.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MikroOrmModule.forRoot(mikroOrmConfig),
  ],
  providers: [EmailDispatchService, DocumentExportService, NotificationConsumer],
})
export class WorkerModule {}
