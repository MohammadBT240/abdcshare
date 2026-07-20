import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import IORedis, { type Redis } from 'ioredis';
import { OutboxEntity } from './infrastructure/persistence/outbox.entity';
import { OutboxService } from './outbox.service';
import { OutboxPublisherService } from './outbox-publisher.service';
import { OUTBOX_REDIS } from './outbox.tokens';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([OutboxEntity])],
  providers: [
    OutboxService,
    OutboxPublisherService,
    {
      provide: OUTBOX_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis | null => {
        const url = config.get<string>('REDIS_URL');
        return url ? new IORedis(url, { maxRetriesPerRequest: null }) : null;
      },
    },
  ],
  exports: [OutboxService],
})
export class OutboxModule {}
