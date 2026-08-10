import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PartnerReportCadence,
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
  @ApiPropertyOptional({ enum: PartnerReportCadence, default: PartnerReportCadence.Weekly })
  @IsOptional() @IsEnum(PartnerReportCadence) cadence?: PartnerReportCadence;
  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() remindersEnabled?: boolean;
  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean() financialsEnabled?: boolean;
}

export class InviteResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() guestUserId!: string;
  @ApiProperty({ enum: PartnerReportInviteStatus }) status!: PartnerReportInviteStatus;
  @ApiProperty() createdAt!: Date;
}

/** Result of an invite attempt: Guest provisioned, Staff allowed, or existing reporter reminded. */
export class InviteResultDto {
  @ApiProperty({ enum: ['invited', 'allowed', 'reminded'] })
  outcome!: 'invited' | 'allowed' | 'reminded';
  @ApiProperty() email!: string;
  @ApiProperty({ description: 'The provisioned Guest, allowed Staff, or reminded reporter.' })
  userId!: string;
  @ApiPropertyOptional() inviteId?: string | null;
}

export class InviteListResponseDto {
  @ApiProperty({ type: [InviteResponseDto] }) data!: InviteResponseDto[];
  @ApiProperty() meta!: PageMeta;
}

export class ReporterDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['partner', 'guest', 'staff', 'client'] })
  kind!: 'partner' | 'guest' | 'staff' | 'client';
  @ApiPropertyOptional({ enum: PartnerReportInviteStatus })
  inviteStatus?: PartnerReportInviteStatus | null;
  @ApiPropertyOptional() allowedAt?: Date | null;
  @ApiProperty({ enum: PartnerReportCadence }) cadence!: PartnerReportCadence;
  @ApiProperty() remindersEnabled!: boolean;
  @ApiProperty() financialsEnabled!: boolean;
  @ApiPropertyOptional() reportRequestedAt?: Date | null;
  @ApiPropertyOptional() requestNote?: string | null;
  @ApiPropertyOptional() lastSubmittedAt?: Date | null;
  /** Soft expectation — never blocks submit. */
  @ApiProperty({ enum: ['ok', 'requested', 'due'] })
  expectation!: 'ok' | 'requested' | 'due';
}

export class ReporterListResponseDto {
  @ApiProperty({ type: [ReporterDto] }) data!: ReporterDto[];
}

export class UpdateReporterDto {
  @ApiPropertyOptional({ enum: PartnerReportCadence })
  @IsOptional() @IsEnum(PartnerReportCadence) cadence?: PartnerReportCadence;
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean() remindersEnabled?: boolean;
  @ApiPropertyOptional()
  @IsOptional() @IsBoolean() financialsEnabled?: boolean;
}

export class RequestReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class MyReportingStatusDto {
  @ApiProperty() canSubmit!: boolean;
  @ApiPropertyOptional({ enum: PartnerReportCadence }) cadence?: PartnerReportCadence | null;
  @ApiProperty() remindersEnabled!: boolean;
  @ApiProperty({ default: true }) financialsEnabled!: boolean;
  @ApiPropertyOptional() reportRequestedAt?: Date | null;
  @ApiPropertyOptional() requestNote?: string | null;
  @ApiPropertyOptional() lastSubmittedAt?: Date | null;
  @ApiProperty({ enum: ['ok', 'requested', 'due'] }) expectation!: 'ok' | 'requested' | 'due';
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

export class BillingItemInput {
  @ApiProperty() @IsString() @MaxLength(255) description!: string;
  @ApiProperty({ description: 'Bill amount as a decimal string' }) @IsString() @MaxLength(40) amount!: string;
  @ApiPropertyOptional({ description: 'Amount received against this bill (default 0)' })
  @IsOptional() @IsString() @MaxLength(40) amountReceived?: string;
}

// ---- Report create / update ----------------------------------------------

export class SaveReportDto {
  @ApiProperty() @IsString() @MaxLength(150) reportingOfficerName!: string;
  @ApiPropertyOptional({ enum: ReportingOfficerTitle })
  @IsOptional() @IsEnum(ReportingOfficerTitle) officerTitle?: ReportingOfficerTitle;
  @ApiProperty({ description: 'Company or department' }) @IsString() @MaxLength(150) department!: string;
  @ApiProperty({ enum: ReportPeriodType }) @IsEnum(ReportPeriodType) periodType!: ReportPeriodType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) periodLabel?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() executiveSummary?: string;

  @ApiPropertyOptional({ enum: ReportCurrency }) @IsOptional() @IsEnum(ReportCurrency) currency?: ReportCurrency;
  @ApiPropertyOptional({ type: [BillingItemInput] })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BillingItemInput)
  billingItems?: BillingItemInput[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remark?: string;

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

export class BillingItemDto {
  @ApiProperty() description!: string;
  @ApiProperty() amount!: string;
  @ApiProperty() amountReceived!: string;
}

export class PartnerReportResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() submittedById!: string;
  @ApiPropertyOptional() submittedByName?: string | null;
  @ApiProperty() reportingOfficerName!: string;
  @ApiPropertyOptional({ enum: ReportingOfficerTitle }) officerTitle?: ReportingOfficerTitle | null;
  @ApiProperty() department!: string;
  @ApiProperty({ enum: ReportPeriodType }) periodType!: ReportPeriodType;
  @ApiPropertyOptional() periodLabel?: string | null;
  @ApiPropertyOptional() executiveSummary?: string | null;
  @ApiPropertyOptional({ enum: ReportCurrency }) currency?: ReportCurrency | null;
  /** Sum of billingItems.amount (server-computed). */
  @ApiPropertyOptional() feeRevenue?: string | null;
  @ApiProperty({ type: [BillingItemDto] }) billingItems!: BillingItemDto[];
  /** Sum of billingItems.amountReceived (server-computed). */
  @ApiPropertyOptional() collectionsReceived?: string | null;
  /** feeRevenue − collectionsReceived (server-computed). */
  @ApiPropertyOptional() outstanding?: string | null;
  @ApiPropertyOptional() remark?: string | null;
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
