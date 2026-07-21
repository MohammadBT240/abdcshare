import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EngagementMemberRole, EngagementStatus, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateEngagementDto {
  @ApiProperty() @IsUUID() clientId!: string;
  @ApiProperty() @IsInt() engagementTypeId!: number;
  @ApiProperty({ description: 'Owning department.' }) @IsInt() departmentId!: number;
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) periodLabel?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() startDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() targetCompletionDate?: Date;
  @ApiPropertyOptional({ type: [Number], description: 'request classes in scope at creation.' })
  @IsOptional() @IsArray() @IsInt({ each: true }) requestClassIds?: number[];
}

export class UpdateEngagementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) periodLabel?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() startDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() targetCompletionDate?: Date;
}

export class TransitionEngagementDto {
  @ApiProperty({ enum: EngagementStatus }) @IsEnum(EngagementStatus) toStatus!: EngagementStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class AddTeamMemberDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty({ enum: EngagementMemberRole }) @IsEnum(EngagementMemberRole) memberRole!: EngagementMemberRole;
}

export class AddRequestClassDto {
  @ApiProperty() @IsInt() requestClassId!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

export class EngagementListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() departmentId?: number;
  @ApiPropertyOptional({ enum: EngagementStatus }) @IsOptional() @IsEnum(EngagementStatus) status?: EngagementStatus;
}

export class EngagementTeamMemberDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: EngagementMemberRole }) memberRole!: EngagementMemberRole;
}

export class EngagementRequestClassDto {
  @ApiProperty() requestClassId!: number;
  @ApiProperty() name!: string;
  @ApiProperty() sortOrder!: number;
}

export class EngagementResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() referenceCode!: string;
  @ApiProperty() clientId!: string;
  @ApiPropertyOptional() clientName?: string | null;
  @ApiProperty() engagementTypeId!: number;
  @ApiPropertyOptional() engagementTypeName?: string | null;
  @ApiProperty() departmentId!: number;
  @ApiPropertyOptional() departmentName?: string | null;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() periodLabel?: string | null;
  @ApiProperty({ enum: EngagementStatus }) status!: EngagementStatus;
  @ApiPropertyOptional() startDate?: Date | null;
  @ApiPropertyOptional() targetCompletionDate?: Date | null;
  @ApiPropertyOptional() completedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class EngagementDetailResponseDto extends EngagementResponseDto {
  @ApiProperty({ type: [EngagementTeamMemberDto] }) team!: EngagementTeamMemberDto[];
  @ApiProperty({ type: [EngagementRequestClassDto] }) requestClasses!: EngagementRequestClassDto[];
}

export class EngagementListResponseDto {
  @ApiProperty({ type: [EngagementResponseDto] }) data!: EngagementResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
