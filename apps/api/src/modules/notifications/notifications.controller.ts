import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { NOTIFICATION_TYPE_CATALOG } from '@abdcshare/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  NotificationListQueryDto,
  NotificationListResponseDto,
  NotificationResponseDto,
  NotificationTypeCatalogItemDto,
  PreferenceResponseDto,
  UpdatePreferenceDto,
} from './presentation/dto/notification.dto';

class UnreadCountDto {
  @ApiProperty() count!: number;
}

class MarkAllReadDto {
  @ApiProperty() updated!: number;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('catalog')
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: [NotificationTypeCatalogItemDto] })
  catalog(): NotificationTypeCatalogItemDto[] {
    return NOTIFICATION_TYPE_CATALOG.map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      category: t.category,
    }));
  }

  @Get()
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: NotificationListResponseDto })
  list(
    @Query() query: NotificationListQueryDto,
    @CurrentUser('userId') userId: string,
  ): Promise<NotificationListResponseDto> {
    return this.notifications.listMine(userId, query);
  }

  @Get('unread-count')
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: UnreadCountDto })
  unreadCount(@CurrentUser('userId') userId: string): Promise<{ count: number }> {
    return this.notifications.unreadCount(userId);
  }

  @Post('read-all')
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: MarkAllReadDto })
  readAll(@CurrentUser('userId') userId: string): Promise<{ updated: number }> {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: NotificationResponseDto })
  read(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<NotificationResponseDto> {
    return this.notifications.markRead(id, userId);
  }

  @Get('preferences')
  @RequirePermission('notification:receive')
  @ApiOkResponse({ type: [PreferenceResponseDto] })
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
  @ApiOkResponse({ type: PreferenceResponseDto })
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
