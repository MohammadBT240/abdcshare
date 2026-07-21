import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateEngagementTypeDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateEngagementTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetAllowedRequestClassesDto {
  @ApiProperty({ type: [Number], description: 'request class ids allowed for this type. Empty ⇒ all allowed.' })
  @IsArray() @IsInt({ each: true }) requestClassIds!: number[];
}

export class EngagementTypeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: string;
}

export class EngagementTypeResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: [Number], description: 'Allowed request class ids ([] ⇒ all allowed).' })
  allowedRequestClassIds!: number[];
}

export class EngagementTypeListResponseDto {
  @ApiProperty({ type: [EngagementTypeResponseDto] }) data!: EngagementTypeResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
