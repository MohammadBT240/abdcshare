import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  NotificationListQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
  PreferenceResponseDto,
  UpdatePreferenceDto,
} from './presentation/dto/notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermission('notification:receive')
  list(
    @Query() query: NotificationListQueryDto,
    @CurrentUser('userId') userId: string,
  ): Promise<NotificationListResponseDto> {
    return this.notifications.listMine(userId, query);
  }

  @Get('unread-count')
  @RequirePermission('notification:receive')
  unreadCount(@CurrentUser('userId') userId: string): Promise<{ count: number }> {
    return this.notifications.unreadCount(userId);
  }

  @Post('read-all')
  @RequirePermission('notification:receive')
  readAll(@CurrentUser('userId') userId: string): Promise<{ updated: number }> {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @RequirePermission('notification:receive')
  read(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notifications.markRead(id, userId);
  }

  @Get('preferences')
  @RequirePermission('notification:receive')
  async preferences(@CurrentUser('userId') userId: string): Promise<PreferenceResponseDto[]> {
    const prefs = await this.notifications.getPreferences(userId);
    return prefs.map((p) => ({
      notificationType: p.notificationType,
      emailEnabled: p.emailEnabled,
      inAppEnabled: p.inAppEnabled,
    }));
  }

  @Put('preferences/:type')
  @RequirePermission('notification:receive')
  async setPreference(
    @Param('type') type: string,
    @Body() dto: UpdatePreferenceDto,
    @CurrentUser('userId') userId: string,
  ): Promise<PreferenceResponseDto> {
    const p = await this.notifications.setPreference(userId, type, dto);
    return {
      notificationType: p.notificationType,
      emailEnabled: p.emailEnabled,
      inAppEnabled: p.inAppEnabled,
    };
  }
}
