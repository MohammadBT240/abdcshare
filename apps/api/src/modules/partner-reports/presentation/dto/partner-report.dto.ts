import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PartnerReportInviteStatus,
  PartnerReportStatus,
  ReportCurrency,
  ReportDecisionPriority,
  ReportingOfficerTitle,
  ReportPeriodType,
  ReportUpdateStatus,
  type PageMeta,
} from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

// ---- Invite (Principal Partner → Guest) -----------------------------------

export class CreateInviteDto {
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsString() @MaxLength(150) fullName!: string;
  @ApiPropertyOptional({ enum: ReportingOfficerTitle })
  @IsOptional() @IsEnum(ReportingOfficerTitle) title?: ReportingOfficerTitle;
}

export class InviteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() guestUserId!: string;
  @ApiProperty({ enum: PartnerReportInviteStatus }) status!: PartnerReportInviteStatus;
  @ApiProperty() createdAt!: Date;
}

/** Result of an invite attempt: a new Guest was provisioned, or an existing user was reminded. */
export class InviteResultDto {
  @ApiProperty({ enum: ['invited', 'reminded'] }) outcome!: 'invited' | 'reminded';
  @ApiProperty() email!: string;
  @ApiProperty({ description: 'The provisioned Guest, or the existing user who was reminded.' })
  userId!: string;
  @ApiPropertyOptional() inviteId?: string | null;
}

export class InviteListResponseDto {
  @ApiProperty({ type: [InviteResponseDto] }) data!: InviteResponseDto[];
  @ApiProperty() meta!: PageMeta;
}

// ---- Report rows ----------------------------------------------------------

export class EngagementUpdateInput {
  @ApiProperty() @IsString() @MaxLength(255) clientEngagement!: string;
  @ApiProperty() @IsString() update!: string;
  @ApiProperty({ enum: ReportUpdateStatus }) @IsEnum(ReportUpdateStatus) status!: ReportUpdateStatus;
}

export class DecisionInput {
  @ApiProperty() @IsString() decision!: string;
  @ApiProperty({ enum: ReportDecisionPriority }) @IsEnum(ReportDecisionPriority) priority!: ReportDecisionPriority;
}

// ---- Report create / update ----------------------------------------------

export class SaveReportDto {
  @ApiProperty() @IsString() @MaxLength(150) reportingOfficerName!: string;
  @ApiProperty({ enum: ReportingOfficerTitle }) @IsEnum(ReportingOfficerTitle) officerTitle!: ReportingOfficerTitle;
  @ApiProperty() @IsString() @MaxLength(150) department!: string;
  @ApiProperty({ enum: ReportPeriodType }) @IsEnum(ReportPeriodType) periodType!: ReportPeriodType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) periodLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() executiveSummary?: string;

  @ApiPropertyOptional({ enum: ReportCurrency }) @IsOptional() @IsEnum(ReportCurrency) currency?: ReportCurrency;
  @ApiPropertyOptional() @IsOptional() @IsString() feeRevenue?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() billingsRaised?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() collectionsReceived?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outstandingWip?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) varianceVsBudget?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() peopleCapacity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() outlook?: string;

  @ApiPropertyOptional({ type: [EngagementUpdateInput] })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => EngagementUpdateInput)
  engagementUpdates?: EngagementUpdateInput[];

  @ApiPropertyOptional({ type: [DecisionInput] })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => DecisionInput)
  decisions?: DecisionInput[];
}

export class ReviewReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ReportListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PartnerReportStatus }) @IsOptional() @IsEnum(PartnerReportStatus) status?: PartnerReportStatus;
  @ApiPropertyOptional({ enum: ReportPeriodType }) @IsOptional() @IsEnum(ReportPeriodType) periodType?: ReportPeriodType;
}

// ---- Report responses -----------------------------------------------------

export class EngagementUpdateDto {
  @ApiProperty() clientEngagement!: string;
  @ApiProperty() update!: string;
  @ApiProperty({ enum: ReportUpdateStatus }) status!: ReportUpdateStatus;
}
export class DecisionDto {
  @ApiProperty() decision!: string;
  @ApiProperty({ enum: ReportDecisionPriority }) priority!: ReportDecisionPriority;
}

export class PartnerReportResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() submittedById!: string;
  @ApiPropertyOptional() submittedByName?: string | null;
  @ApiProperty() reportingOfficerName!: string;
  @ApiProperty({ enum: ReportingOfficerTitle }) officerTitle!: ReportingOfficerTitle;
  @ApiProperty() department!: string;
  @ApiProperty({ enum: ReportPeriodType }) periodType!: ReportPeriodType;
  @ApiPropertyOptional() periodLabel?: string | null;
  @ApiPropertyOptional() executiveSummary?: string | null;
  @ApiPropertyOptional({ enum: ReportCurrency }) currency?: ReportCurrency | null;
  @ApiPropertyOptional() feeRevenue?: string | null;
  @ApiPropertyOptional() billingsRaised?: string | null;
  @ApiPropertyOptional() collectionsReceived?: string | null;
  @ApiPropertyOptional() outstandingWip?: string | null;
  @ApiPropertyOptional() varianceVsBudget?: string | null;
  @ApiPropertyOptional() peopleCapacity?: string | null;
  @ApiPropertyOptional() outlook?: string | null;
  @ApiProperty({ enum: PartnerReportStatus }) status!: PartnerReportStatus;
  @ApiPropertyOptional() submittedAt?: Date | null;
  @ApiPropertyOptional() reviewNotes?: string | null;
  @ApiPropertyOptional() reviewedAt?: Date | null;
  @ApiProperty() isGuest!: boolean;
  @ApiProperty({ type: [EngagementUpdateDto] }) engagementUpdates!: EngagementUpdateDto[];
  @ApiProperty({ type: [DecisionDto] }) decisions!: DecisionDto[];
  @ApiProperty() createdAt!: Date;
}

export class PartnerReportListResponseDto {
  @ApiProperty({ type: [PartnerReportResponseDto] }) data!: PartnerReportResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
