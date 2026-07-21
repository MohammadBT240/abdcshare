import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { ReviewStatus, type PageMeta } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class SubmitReviewDto {
  @ApiPropertyOptional({ description: 'Review target: a request…' })
  @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional({ description: '…or a document (exactly one of the two).' })
  @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional({ description: 'Who should review (a Super Admin).' })
  @IsOptional() @IsUUID() reviewerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export type ReviewDecision = ReviewStatus.Approved | ReviewStatus.SentBack;

export class DecideReviewDto {
  @ApiProperty({ enum: [ReviewStatus.Approved, ReviewStatus.SentBack] })
  @IsIn([ReviewStatus.Approved, ReviewStatus.SentBack])
  decision!: ReviewDecision;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ReviewListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string;
  @ApiPropertyOptional({ enum: ReviewStatus }) @IsOptional() @IsEnum(ReviewStatus) status?: ReviewStatus;
}

export class ReviewResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() requestId?: string | null;
  @ApiPropertyOptional() documentId?: string | null;
  @ApiProperty() preparerId!: string;
  @ApiPropertyOptional() preparerName?: string | null;
  @ApiPropertyOptional() reviewerId?: string | null;
  @ApiPropertyOptional() reviewerName?: string | null;
  @ApiProperty({ enum: ReviewStatus }) status!: ReviewStatus;
  @ApiPropertyOptional() notes?: string | null;
  @ApiProperty() submittedAt!: Date;
  @ApiPropertyOptional() decidedAt?: Date | null;
}

export class ReviewListResponseDto {
  @ApiProperty({ type: [ReviewResponseDto] }) data!: ReviewResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
