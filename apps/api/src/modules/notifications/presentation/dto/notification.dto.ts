import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class NotificationListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Set "true" to return only unread.' })
  @IsOptional() @IsString() unread?: string;
}

export class UpdatePreferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() inAppEnabled?: boolean;
}

export class NotificationResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() body?: string | null;
  @ApiPropertyOptional() entityType?: string | null;
  @ApiPropertyOptional() entityId?: string | null;
  @ApiPropertyOptional() link?: string | null;
  @ApiProperty() isRead!: boolean;
  @ApiPropertyOptional() readAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class NotificationListResponseDto {
  @ApiProperty({ type: [NotificationResponseDto] }) data!: NotificationResponseDto[];
  @ApiProperty() meta!: PageMeta;
}

export class PreferenceResponseDto {
  @ApiProperty() notificationType!: string;
  @ApiProperty() emailEnabled!: boolean;
  @ApiProperty() inAppEnabled!: boolean;
}

export class NotificationTypeCatalogItemDto {
  @ApiProperty() type!: string;
  @ApiProperty() label!: string;
  @ApiProperty() description!: string;
  @ApiProperty() category!: string;
}
