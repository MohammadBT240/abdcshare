import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SubmissionStatus, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class SubmissionFilePresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class SubmissionFileConfirmDto {
  @ApiProperty() @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
}

export class SubmissionFileDto {
  @ApiProperty() id!: string;
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
  @ApiProperty({ enum: SubmissionStatus }) status!: SubmissionStatus;
}

export class CreateSubmissionDto {
  @ApiProperty() @IsString() message!: string;
}

/** A review decision is terminal: Accepted or Returned (not Pending). */
export type SubmissionDecision = SubmissionStatus.Accepted | SubmissionStatus.Returned;

export class ReviewSubmissionDto {
  @ApiProperty({ enum: [SubmissionStatus.Accepted, SubmissionStatus.Returned] })
  @IsIn([SubmissionStatus.Accepted, SubmissionStatus.Returned])
  decision!: SubmissionDecision;

  @ApiPropertyOptional({ description: 'Reason (recommended when returning).' })
  @IsOptional() @IsString() reason?: string;
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
