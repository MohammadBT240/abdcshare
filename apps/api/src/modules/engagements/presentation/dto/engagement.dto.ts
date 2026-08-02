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
import { EngagementMemberRole, EngagementPhase, EngagementStage, type PageMeta } from '@abdcshare/shared';
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

export class CloneEngagementDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) periodLabel?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() startDate?: Date;
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() targetCompletionDate?: Date;
}

export class TransitionEngagementDto {
  @ApiProperty({ enum: EngagementStage }) @IsEnum(EngagementStage) toStage!: EngagementStage;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class AddTeamMemberDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiPropertyOptional({
    enum: EngagementMemberRole,
    default: EngagementMemberRole.Member,
    description: 'Defaults to Member. Passing Lead elevates this user (demotes the previous Lead).',
  })
  @IsOptional()
  @IsEnum(EngagementMemberRole)
  memberRole?: EngagementMemberRole;
}

export class AddRequestClassDto {
  @ApiProperty() @IsInt() requestClassId!: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() sortOrder?: number;
}

export class EngagementListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() departmentId?: number;
  @ApiPropertyOptional({ enum: EngagementStage }) @IsOptional() @IsEnum(EngagementStage) stage?: EngagementStage;
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
  @ApiProperty({ enum: EngagementStage }) stage!: EngagementStage;
  @ApiPropertyOptional() startDate?: Date | null;
  @ApiPropertyOptional() targetCompletionDate?: Date | null;
  @ApiPropertyOptional() completedAt?: Date | null;
  @ApiProperty() createdAt!: Date;
}

export class EngagementListItemDto extends EngagementResponseDto {
  @ApiProperty() requestCount!: number;
  @ApiProperty() overdueCount!: number;
  @ApiProperty() teamSize!: number;
}

export class EngagementDetailResponseDto extends EngagementResponseDto {
  @ApiProperty({ type: [EngagementTeamMemberDto] }) team!: EngagementTeamMemberDto[];
  @ApiProperty({ type: [EngagementRequestClassDto] }) requestClasses!: EngagementRequestClassDto[];
}

export class EngagementListResponseDto {
  @ApiProperty({ type: [EngagementListItemDto] }) data!: EngagementListItemDto[];
  @ApiProperty() meta!: PageMeta;
}

export class CreateSignOffDto {
  @ApiPropertyOptional({ description: 'Request class to sign off; omit for an engagement-wide sign-off.' })
  @IsOptional() @IsInt() requestClassId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class RevokeSignOffDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class SignOffResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() requestClassId?: number | null;
  @ApiPropertyOptional() requestClassName?: string | null;
  @ApiProperty() signedById!: string;
  @ApiPropertyOptional() signedByName?: string | null;
  @ApiProperty() signedAt!: Date;
  @ApiPropertyOptional() note?: string | null;
  @ApiProperty() revoked!: boolean;
  @ApiPropertyOptional() revokedAt?: Date | null;
}

export class ClassRollupDto {
  @ApiProperty() requestClassId!: number;
  @ApiProperty() name!: string;
  @ApiProperty() total!: number;
  @ApiProperty() done!: number;
  @ApiProperty() overdue!: number;
  @ApiProperty() progressPercent!: number;
  @ApiProperty() signedOff!: boolean;
  @ApiProperty({
    description: 'Request counts for this class keyed by EngagementPhase.',
    example: { Planning: 0, Execution: 0, Reporting: 0 },
  })
  phaseCounts!: Record<EngagementPhase, number>;
}

export class SubmissionCountsDto {
  @ApiProperty({ description: 'Total client submission files on the engagement' })
  uploaded!: number;
  @ApiProperty({ description: 'Submissions awaiting staff review (Pending)' })
  awaitingReview!: number;
  @ApiProperty() returned!: number;
  @ApiProperty() accepted!: number;
  @ApiProperty({ description: 'Staff document reviews in ForReview' })
  underReview!: number;
}

export class EngagementWorkspaceResponseDto extends EngagementDetailResponseDto {
  @ApiProperty({ type: [SignOffResponseDto] }) signOffs!: SignOffResponseDto[];
  @ApiProperty({ type: [ClassRollupDto] }) classRollups!: ClassRollupDto[];
  @ApiProperty({
    description: 'Request counts keyed by EngagementPhase (Planning / Execution / Reporting).',
    example: { Planning: 0, Execution: 0, Reporting: 0 },
  })
  phaseCounts!: Record<EngagementPhase, number>;
  @ApiProperty() progressPercent!: number;
  @ApiProperty() overdueCount!: number;
  @ApiProperty() requestCount!: number;
  @ApiProperty({ type: SubmissionCountsDto })
  submissionCounts!: SubmissionCountsDto;
  @ApiProperty({ enum: EngagementStage, isArray: true }) allowedNextStages!: EngagementStage[];
  @ApiProperty() canComplete!: boolean;
  @ApiProperty({ type: [Number] }) missingRequestClassIds!: number[];
  @ApiProperty() hasEngagementWideSignOff!: boolean;
  /** Viewer is the Lead on this engagement's team. */
  @ApiProperty() viewerIsLead!: boolean;
  /** SA global update OR Lead on this engagement. */
  @ApiProperty() canManageEngagement!: boolean;
  /** SA global transition OR Lead on this engagement. */
  @ApiProperty() canTransitionEngagement!: boolean;
  /** SA global sign-off OR Lead on this engagement. */
  @ApiProperty() canSignOffEngagement!: boolean;
}

export class EngagementHistoryItemDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional({ enum: EngagementStage }) fromStage?: EngagementStage | null;
  @ApiProperty({ enum: EngagementStage }) toStage!: EngagementStage;
  @ApiPropertyOptional() changedById?: string | null;
  @ApiPropertyOptional() changedByName?: string | null;
  @ApiProperty() changedAt!: Date;
  @ApiPropertyOptional() note?: string | null;
}
