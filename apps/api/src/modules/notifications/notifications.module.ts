import { Global, Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { NotificationEntity } from './infrastructure/persistence/notification.entity';
import { NotificationPreferenceEntity } from './infrastructure/persistence/notification-preference.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';

@Global()
@Module({
  imports: [MikroOrmModule.forFeature([NotificationEntity, NotificationPreferenceEntity])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
