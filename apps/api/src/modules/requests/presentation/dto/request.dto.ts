import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import type { PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateRequestDto {
  @ApiProperty() @IsUUID() engagementId!: string;
  @ApiProperty({ description: 'Request type (its request class must be in the engagement scope).' })
  @IsInt() requestTypeId!: number;
  @ApiProperty() @IsString() description!: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  @ApiPropertyOptional({ description: 'Defaults to the first stage if omitted.' })
  @IsOptional() @IsInt() stageId?: number;
  @ApiPropertyOptional({ description: 'Defaults to the first status if omitted.' })
  @IsOptional() @IsInt() statusId?: number;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @IsUUID('4', { each: true }) assigneeIds?: string[];
}

export class UpdateRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
}

export class SetStageDto {
  @ApiProperty() @IsInt() stageId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class SetStatusDto {
  @ApiProperty() @IsInt() statusId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class AssignRequestDto {
  @ApiProperty() @IsUUID() userId!: string;
}

export class RequestListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() requestClassId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() stageId?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() statusId?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
}

export class RequestAssigneeDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
}

export class RequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() requestTypeId!: number;
  @ApiPropertyOptional() requestTypeName?: string | null;
  @ApiProperty() requestClassId!: number;
  @ApiPropertyOptional() requestClassName?: string | null;
  @ApiPropertyOptional() stageId?: number | null;
  @ApiPropertyOptional() stageName?: string | null;
  @ApiPropertyOptional() statusId?: number | null;
  @ApiPropertyOptional() statusName?: string | null;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() dueDate?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class RequestDetailResponseDto extends RequestResponseDto {
  @ApiProperty({ type: [RequestAssigneeDto] }) assignees!: RequestAssigneeDto[];
}

export class RequestListResponseDto {
  @ApiProperty({ type: [RequestResponseDto] }) data!: RequestResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
