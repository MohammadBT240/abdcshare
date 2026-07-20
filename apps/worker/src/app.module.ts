import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { validateEnv } from './config/env.schema';
import mikroOrmConfig from './database/mikro-orm.config';
import { EmailDispatchService } from './email/email-dispatch.service';
import { NotificationConsumer } from './consumers/notification.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    MikroOrmModule.forRoot(mikroOrmConfig),
  ],
  providers: [EmailDispatchService, NotificationConsumer],
})
export class WorkerModule {}
