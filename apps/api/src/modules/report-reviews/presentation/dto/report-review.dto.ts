import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from "class-validator";
import {
  DocumentStatus,
  ReportReviewDecision,
  ReportReviewState,
  type PageMeta,
} from "@abdcshare/shared";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

/** Client decision on the current cycle — Approved or ChangesRequested (not Pending). */
export type RespondDecision =
  ReportReviewDecision.Approved | ReportReviewDecision.ChangesRequested;

export class RespondReportDto {
  @ApiProperty({
    enum: [
      ReportReviewDecision.Approved,
      ReportReviewDecision.ChangesRequested,
    ],
  })
  @IsIn([ReportReviewDecision.Approved, ReportReviewDecision.ChangesRequested])
  decision!: RespondDecision;

  @ApiPropertyOptional({ description: "Required when requesting changes." })
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class OverrideReportDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class PendingReportListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['pending', 'all'],
    description:
      'pending = AwaitingClient only (default); all = every report already sent to the client',
  })
  @IsOptional()
  @IsIn(['pending', 'all'])
  state?: 'pending' | 'all';
}

export class FirmReportListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ["needsAction", "awaitingClient", "all"],
    description: "needsAction = ChangesRequested | Locked (default)",
  })
  @IsOptional()
  @IsIn(["needsAction", "awaitingClient", "all"])
  state?: "needsAction" | "awaitingClient" | "all";

  @ApiPropertyOptional({ description: "Filter to a single engagement" })
  @IsOptional()
  @IsUUID()
  engagementId?: string;

  @ApiPropertyOptional({
    enum: ReportReviewState,
    description: "Exact client-review state (narrows within the state tab)",
  })
  @IsOptional()
  @IsEnum(ReportReviewState)
  reviewState?: ReportReviewState;
}

export class ReportFileDto {
  @ApiProperty() id!: string;
  @ApiProperty() version!: number;
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
}

export class ReviewCycleDto {
  @ApiProperty() id!: string;
  @ApiProperty() roundNo!: number;
  @ApiProperty() fileVersion!: number;
  @ApiProperty({ enum: ReportReviewDecision }) decision!: ReportReviewDecision;
  @ApiProperty() sentAt!: Date;
  @ApiPropertyOptional() decidedAt?: Date | null;
  @ApiPropertyOptional() feedback?: string | null;
  @ApiPropertyOptional({ type: ReportFileDto }) file?: ReportFileDto | null;
}

export class ReportReviewStatusDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() engagementReferenceCode!: string;
  @ApiProperty() engagementTitle!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: DocumentStatus }) documentStatus!: DocumentStatus;
  @ApiProperty({ enum: ReportReviewState }) reviewState!: ReportReviewState;
  @ApiProperty() reviewRound!: number;
  @ApiProperty() maxRounds!: number;
  @ApiProperty() currentVersion!: number;
  @ApiPropertyOptional({ type: ReportFileDto })
  currentFile?: ReportFileDto | null;
  @ApiProperty({ type: [ReviewCycleDto] }) cycles!: ReviewCycleDto[];
}

export class ClientPendingReportDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() engagementReferenceCode!: string;
  @ApiProperty() engagementTitle!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ReportReviewState }) reviewState!: ReportReviewState;
  @ApiProperty() reviewRound!: number;
  @ApiProperty() currentVersion!: number;
  @ApiPropertyOptional() sentAt?: string | null;
  @ApiPropertyOptional() fileName?: string | null;
  @ApiPropertyOptional() mimeType?: string | null;
}

export class ClientPendingReportListDto {
  @ApiProperty({ type: [ClientPendingReportDto] })
  data!: ClientPendingReportDto[];
  @ApiProperty() meta!: PageMeta;
}

export class FirmReportListItemDto {
  @ApiProperty() documentId!: string;
  @ApiProperty() engagementId!: string;
  @ApiProperty() engagementReferenceCode!: string;
  @ApiProperty() engagementTitle!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: ReportReviewState }) reviewState!: ReportReviewState;
  @ApiProperty() reviewRound!: number;
  @ApiProperty() currentVersion!: number;
  @ApiPropertyOptional() latestFeedback?: string | null;
  @ApiProperty() updatedAt!: Date;
}

export class FirmReportListDto {
  @ApiProperty({ type: [FirmReportListItemDto] })
  data!: FirmReportListItemDto[];
  @ApiProperty() meta!: PageMeta;
}

export class DownloadUrlResponseDto {
  @ApiProperty() url!: string;
}
