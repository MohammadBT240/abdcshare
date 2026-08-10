import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateRequestClassDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) code?: string;
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateRequestClassDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class RequestClassListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by active state.' })
  @IsOptional() @IsString() isActive?: string;
}

export class RequestClassResponseDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional() code?: string | null;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty() isActive!: boolean;
}

export class RequestClassListResponseDto {
  @ApiProperty({ type: [RequestClassResponseDto] }) data!: RequestClassResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
