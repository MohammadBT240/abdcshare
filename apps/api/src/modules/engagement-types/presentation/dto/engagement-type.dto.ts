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
  @ApiProperty({
    type: [Number],
    description: 'Suggested request class ids for this type (defaults on create). Empty ⇒ no suggestions.',
  })
  @IsArray() @IsInt({ each: true }) requestClassIds!: number[];
}

export class EngagementTypeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: string;
}

export class EngagementTypeResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({
    type: [Number],
    description: 'Suggested request class ids for new engagements of this type ([] ⇒ no suggestions).',
  })
  suggestedRequestClassIds!: number[];
}

export class EngagementTypeListResponseDto {
  @ApiProperty({ type: [EngagementTypeResponseDto] }) data!: EngagementTypeResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
