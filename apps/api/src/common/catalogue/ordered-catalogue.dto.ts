import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../dto/pagination-query.dto';

export class OrderedCreateDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class OrderedUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class OrderedListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: string;
}

export class OrderedResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
}

export class OrderedListResponseDto {
  @ApiProperty({ type: [OrderedResponseDto] }) data!: OrderedResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
