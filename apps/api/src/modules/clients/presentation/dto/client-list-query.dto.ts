import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class ClientListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() clientTypeId?: number;
  @ApiPropertyOptional({ enum: ['true', 'false'] }) @IsOptional() @IsBooleanString() isActive?: string;
}
