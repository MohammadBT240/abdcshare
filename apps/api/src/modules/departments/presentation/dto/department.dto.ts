import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateDepartmentDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class DepartmentListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() isActive?: string;
}

export class DepartmentResponseDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
}

export class DepartmentListResponseDto {
  @ApiProperty({ type: [DepartmentResponseDto] }) data!: DepartmentResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
