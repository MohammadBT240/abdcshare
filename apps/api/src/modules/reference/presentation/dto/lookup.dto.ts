import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateLookupDto {
  @ApiProperty() @IsString() @MaxLength(255) name!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ description: 'Parent id (required for lgas → state, wards → lga).' })
  @IsOptional() @IsInt() parentId?: number;
}

export class UpdateLookupDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() parentId?: number;
}

export class LookupListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by parent id (lgas by state, wards by lga).' })
  @IsOptional() @Type(() => Number) @IsInt() parentId?: number;
}
