import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { SubmissionStatus, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class SubmissionFilePresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
  /** When set, allows presign against Returned/UnderReview submissions for replacement. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() replacesFileId?: string;
}

export class SubmissionFileConfirmDto {
  @ApiProperty() @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
  /** When set, this file replaces a Returned file on the same submission. */
  @ApiPropertyOptional() @IsOptional() @IsUUID() replacesFileId?: string;
}

export class SubmissionFileDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
  @ApiProperty({ enum: SubmissionStatus }) status!: SubmissionStatus;
  @ApiPropertyOptional() reviewReason?: string | null;
  @ApiPropertyOptional() reviewedAt?: Date | null;
  @ApiPropertyOptional() replacesFileId?: string | null;
  /** True when another file on this submission replaces this one. */
  @ApiProperty() superseded!: boolean;
  @ApiProperty() uploadedAt!: Date;
}

export class CreateSubmissionDto {
  @ApiProperty() @IsString() message!: string;
}

/** A review decision is terminal: Accepted or Returned (not Pending/UnderReview). */
export type SubmissionDecision = SubmissionStatus.Accepted | SubmissionStatus.Returned;

export class ReviewSubmissionDto {
  @ApiProperty({ enum: [SubmissionStatus.Accepted, SubmissionStatus.Returned] })
  @IsIn([SubmissionStatus.Accepted, SubmissionStatus.Returned])
  decision!: SubmissionDecision;

  @ApiPropertyOptional({ description: 'Reason (recommended when returning).' })
  @IsOptional() @IsString() reason?: string;
}

export class ReviewSubmissionFileDto {
  @ApiProperty({ enum: [SubmissionStatus.Accepted, SubmissionStatus.Returned] })
  @IsIn([SubmissionStatus.Accepted, SubmissionStatus.Returned])
  decision!: SubmissionDecision;

  @ApiPropertyOptional({ description: 'Reason (required when returning).' })
  @IsOptional() @IsString() reason?: string;
}

/** Reopen an Accepted file into UnderReview (does not return / unlock replace). */
export class ReopenSubmissionFileDto {
  @ApiProperty({ description: 'Reason explaining why acceptance is reopened for review.' })
  @IsString()
  reason!: string;
}

/** Undo a file return (Returned → UnderReview) with a required note. */
export class UndoReturnSubmissionFileDto {
  @ApiProperty({ description: 'Reason explaining why the return is being undone.' })
  @IsString()
  reason!: string;
}

export class SubmissionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: SubmissionStatus })
  @IsOptional() @IsEnum(SubmissionStatus) status?: SubmissionStatus;
}

export class SubmissionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() submittedById!: string;
  @ApiPropertyOptional() submittedByName?: string | null;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: SubmissionStatus }) status!: SubmissionStatus;
  @ApiPropertyOptional() reviewedById?: string | null;
  @ApiPropertyOptional() reviewReason?: string | null;
  @ApiPropertyOptional() reviewedAt?: Date | null;
  @ApiProperty({ type: [SubmissionFileDto] }) files!: SubmissionFileDto[];
  @ApiProperty() createdAt!: Date;
}

export class SubmissionListResponseDto {
  @ApiProperty({ type: [SubmissionResponseDto] }) data!: SubmissionResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
