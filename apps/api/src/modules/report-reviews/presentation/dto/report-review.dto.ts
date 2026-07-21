import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  DocumentStatus,
  ReportReviewDecision,
  ReportReviewState,
  type PageMeta,
} from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

/** Client decision on the current cycle — Approved or ChangesRequested (not Pending). */
export type RespondDecision = ReportReviewDecision.Approved | ReportReviewDecision.ChangesRequested;

export class RespondReportDto {
  @ApiProperty({ enum: [ReportReviewDecision.Approved, ReportReviewDecision.ChangesRequested] })
  @IsIn([ReportReviewDecision.Approved, ReportReviewDecision.ChangesRequested])
  decision!: RespondDecision;

  @ApiPropertyOptional({ description: 'Required when requesting changes.' })
  @IsOptional() @IsString() feedback?: string;
}

export class OverrideReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class PendingReportListQueryDto extends PaginationQueryDto {}

export class ReviewCycleDto {
  @ApiProperty() id!: string;
  @ApiProperty() roundNo!: number;
  @ApiProperty() fileVersion!: number;
  @ApiProperty({ enum: ReportReviewDecision }) decision!: ReportReviewDecision;
  @ApiProperty() sentAt!: Date;
  @ApiPropertyOptional() decidedAt?: Date | null;
  @ApiPropertyOptional() feedback?: string | null;
}

export class ReportReviewStatusDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: DocumentStatus }) documentStatus!: DocumentStatus;
  @ApiProperty({ enum: ReportReviewState }) reviewState!: ReportReviewState;
  @ApiProperty() reviewRound!: number;
  @ApiProperty() maxRounds!: number;
  @ApiProperty() currentVersion!: number;
  @ApiProperty({ type: [ReviewCycleDto] }) cycles!: ReviewCycleDto[];
}

export class ClientPendingReportDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ReportReviewState }) reviewState!: ReportReviewState;
  @ApiProperty() reviewRound!: number;
  @ApiProperty() currentVersion!: number;
}

export class ClientPendingReportListDto {
  @ApiProperty({ type: [ClientPendingReportDto] }) data!: ClientPendingReportDto[];
  @ApiProperty() meta!: PageMeta;
}

export class DownloadUrlResponseDto {
  @ApiProperty() url!: string;
}
