import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateRequestTypeDto {
  @ApiProperty({ description: 'request class this request type belongs to.' })
  @IsInt() requestClassId!: number;
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) expectedDocuments?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateRequestTypeDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() requestClassId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) expectedDocuments?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class RequestTypeListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by request class id.' })
  @IsOptional() @Type(() => Number) @IsInt() requestClassId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: string;
}

export class RequestTypeResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() requestClassId!: number;
  @ApiPropertyOptional() requestClassName?: string | null;
  @ApiProperty() name!: string;
  @ApiProperty() expectedDocuments!: number;
  @ApiProperty() isActive!: boolean;
}

export class RequestTypeListResponseDto {
  @ApiProperty({ type: [RequestTypeResponseDto] }) data!: RequestTypeResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
