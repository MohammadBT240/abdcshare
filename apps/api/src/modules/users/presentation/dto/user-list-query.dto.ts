import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBooleanString, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class UserListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() roleId?: number;
  @ApiPropertyOptional({ enum: ['true', 'false'] })
  @IsOptional() @IsBooleanString() @Transform(({ value }) => value) isActive?: string;
}
