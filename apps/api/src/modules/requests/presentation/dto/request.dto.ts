import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { EngagementPhase, type PageMeta } from "@abdcshare/shared";
import { PaginationQueryDto } from "../../../../common/dto/pagination-query.dto";

export class CreateRequestDto {
  @ApiProperty() @IsUUID() engagementId!: string;
  @ApiProperty({
    description:
      "Request type (its request class must be in the engagement scope).",
  })
  @IsInt()
  requestTypeId!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
  @ApiPropertyOptional({
    description:
      "Expected client documents for progress. Defaults to the request type value.",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  expectedDocumentCount?: number;
  @ApiPropertyOptional({
    description: "Defaults to the first stage if omitted.",
  })
  @IsOptional()
  @IsInt()
  stageId?: number;
  @ApiPropertyOptional({
    description: "Defaults to the first status if omitted.",
  })
  @IsOptional()
  @IsInt()
  statusId?: number;
  @ApiPropertyOptional({
    enum: EngagementPhase,
    description: "Defaults to the engagement stage.",
  })
  @IsOptional()
  @IsEnum(EngagementPhase)
  phase?: EngagementPhase;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  assigneeIds?: string[];
}

export class UpdateRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  expectedDocumentCount?: number;
}

export class PresignRequestBriefDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(255) contentType!: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes?: number;
}

export class ConfirmRequestBriefDto {
  @ApiProperty() @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(255) contentType!: string;
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes!: number;
}

export class RequestBriefDto {
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() contentType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
  @ApiPropertyOptional() uploadedAt?: Date | null;
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

export class BulkUpdateRequestsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID("4", { each: true })
  ids!: string[];

  @ApiPropertyOptional() @IsOptional() @IsInt() stageId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() statusId?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeUserId?: string;
}

export class RequestListQueryDto extends PaginationQueryDto {
  /** @deprecated Prefer engagementIds */
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  /** Comma-separated engagement UUIDs (multi-select). */
  @ApiPropertyOptional() @IsOptional() @IsString() engagementIds?: string;
  /** Comma-separated client UUIDs (multi-select filter). */
  @ApiPropertyOptional() @IsOptional() @IsString() clientIds?: string;
  /** @deprecated Prefer requestClassIds */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  requestClassId?: number;
  /** Comma-separated request class ids. */
  @ApiPropertyOptional() @IsOptional() @IsString() requestClassIds?: string;
  /** @deprecated Prefer stageIds */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stageId?: number;
  /** Comma-separated stage ids. */
  @ApiPropertyOptional() @IsOptional() @IsString() stageIds?: string;
  /** @deprecated Prefer statusIds */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  statusId?: number;
  /** Comma-separated status ids. */
  @ApiPropertyOptional() @IsOptional() @IsString() statusIds?: string;
  /** @deprecated Prefer assigneeIds */
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  /** Comma-separated assignee user UUIDs. */
  @ApiPropertyOptional() @IsOptional() @IsString() assigneeIds?: string;
  @ApiPropertyOptional({ enum: ["overdue", "today", "next7Days", "noDue"] })
  @IsOptional()
  @IsIn(["overdue", "today", "next7Days", "noDue"])
  due?: "overdue" | "today" | "next7Days" | "noDue";
  /** Filter requests due on this calendar day (YYYY-MM-DD). Ignored when `due` is set. */
  @ApiPropertyOptional() @IsOptional() @Type(() => Date) @IsDate() dueDate?: Date;
  /** @deprecated Prefer phases */
  @ApiPropertyOptional({ enum: EngagementPhase })
  @IsOptional()
  @IsEnum(EngagementPhase)
  phase?: EngagementPhase;
  /** Comma-separated EngagementPhase values. */
  @ApiPropertyOptional() @IsOptional() @IsString() phases?: string;
}

export class RequestAssigneeDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
  @ApiPropertyOptional() avatarUrl?: string | null;
}

export class RequestResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() engagementId!: string;
  @ApiPropertyOptional() engagementTitle?: string | null;
  @ApiPropertyOptional() engagementReferenceCode?: string | null;
  @ApiPropertyOptional() clientId?: string | null;
  @ApiPropertyOptional() clientName?: string | null;
  @ApiPropertyOptional() departmentId?: number | null;
  @ApiPropertyOptional() departmentName?: string | null;
  @ApiProperty() requestTypeId!: number;
  @ApiPropertyOptional() requestTypeName?: string | null;
  @ApiProperty() requestClassId!: number;
  @ApiPropertyOptional() requestClassName?: string | null;
  @ApiPropertyOptional() stageId?: number | null;
  @ApiPropertyOptional() stageName?: string | null;
  @ApiPropertyOptional() statusId?: number | null;
  @ApiPropertyOptional() statusName?: string | null;
  @ApiPropertyOptional({ enum: EngagementPhase })
  phase?: EngagementPhase | null;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() dueDate?: Date | null;
  @ApiProperty() expectedDocumentCount!: number;
  @ApiProperty() acceptedFileCount!: number;
  @ApiProperty() progressPercent!: number;
  @ApiProperty({ description: 'Past due and not in a done status (Accepted/Closed)' })
  isOverdue!: boolean;
  @ApiPropertyOptional({ type: RequestBriefDto, nullable: true })
  brief?: RequestBriefDto | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty({ type: [RequestAssigneeDto] }) assignees!: RequestAssigneeDto[];
}

export class RequestDetailResponseDto extends RequestResponseDto {}

export class RequestListResponseDto {
  @ApiProperty({ type: [RequestResponseDto] }) data!: RequestResponseDto[];
  @ApiProperty() meta!: PageMeta;
}

export class RequestHistoryItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() eventType!: string;
  @ApiProperty() module!: string;
  @ApiPropertyOptional() fromValue?: string | null;
  @ApiPropertyOptional() toValue?: string | null;
  @ApiPropertyOptional() note?: string | null;
  @ApiPropertyOptional() actorId?: string | null;
  @ApiPropertyOptional() actorName?: string | null;
  @ApiPropertyOptional() actorAvatarUrl?: string | null;
  @ApiProperty() createdAt!: Date;
}
