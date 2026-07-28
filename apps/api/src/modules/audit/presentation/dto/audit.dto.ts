import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class AuditListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
}

export class AuditResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() actorId?: string | null;
  @ApiProperty() action!: string;
  @ApiProperty() entityType!: string;
  @ApiPropertyOptional() entityId?: string | null;
  @ApiPropertyOptional() ipAddress?: string | null;
  @ApiPropertyOptional() metadata?: Record<string, unknown> | null;
  @ApiProperty() createdAt!: Date;
}

export class AuditListResponseDto {
  @ApiProperty({ type: [AuditResponseDto] }) data!: AuditResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
