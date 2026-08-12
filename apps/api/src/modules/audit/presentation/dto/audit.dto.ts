import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class AuditListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  /** UUID entities only (engagements, users, …). Numeric catalogue ids cannot use this filter. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actorId?: string;
  @ApiPropertyOptional({ description: 'ISO date or datetime (inclusive start)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;
  @ApiPropertyOptional({ description: 'ISO date or datetime (inclusive end)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}

export class AuditResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() actorId?: string | null;
  @ApiPropertyOptional() actorName?: string | null;
  @ApiPropertyOptional() actorEmail?: string | null;
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
