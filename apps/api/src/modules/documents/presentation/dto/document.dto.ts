import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  DocumentCategory,
  DocumentParticipantRole,
  DocumentStatus,
  EngagementPhase,
  type PageMeta,
} from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateDocumentDto {
  @ApiProperty() @IsUUID() engagementId!: string;
  @ApiPropertyOptional({
    description:
      'Optional request class for WorkingPaper only (must be in engagement scope). Ignored for FinalReport and Supporting.',
  })
  @IsOptional() @IsInt() requestClassId?: number;
  @ApiPropertyOptional({
    description: 'Optional request link for WorkingPaper only. Ignored for FinalReport and Supporting.',
  })
  @IsOptional() @IsUUID() requestId?: string;
  @ApiProperty({ enum: DocumentCategory }) @IsEnum(DocumentCategory) category!: DocumentCategory;
  @ApiPropertyOptional({ enum: EngagementPhase, description: 'Defaults to the engagement stage.' })
  @IsOptional() @IsEnum(EngagementPhase) phase?: EngagementPhase;
  @ApiProperty() @IsString() @MaxLength(255) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class UpdateDocumentDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
}

export class PresignUploadDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class ConfirmUploadDto {
  @ApiProperty({ description: 'The storageKey returned by the presign step.' })
  @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
}

export class PresignBatchDto {
  @ApiProperty({ type: [PresignUploadDto] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => PresignUploadDto)
  files!: PresignUploadDto[];
}

export class ConfirmBatchDto {
  @ApiProperty({ type: [ConfirmUploadDto] })
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => ConfirmUploadDto)
  files!: ConfirmUploadDto[];
}

export class AddDocumentParticipantDto {
  @ApiProperty() @IsUUID() userId!: string;
  @ApiProperty({ enum: DocumentParticipantRole })
  @IsEnum(DocumentParticipantRole)
  participantRole!: DocumentParticipantRole;
}

export class SetDocumentStatusDto {
  @ApiProperty({ enum: DocumentStatus }) @IsEnum(DocumentStatus) status!: DocumentStatus;
}

export class DocumentListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() requestClassId?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() requestId?: string;
  @ApiPropertyOptional({ enum: DocumentCategory }) @IsOptional() @IsEnum(DocumentCategory) category?: DocumentCategory;
  @ApiPropertyOptional({ enum: DocumentStatus }) @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @ApiPropertyOptional({ enum: EngagementPhase }) @IsOptional() @IsEnum(EngagementPhase) phase?: EngagementPhase;
}

export class ExportDocumentsDto {
  @ApiProperty() @IsUUID() engagementId!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() requestClassId?: number;
  @ApiPropertyOptional({ enum: DocumentCategory })
  @IsOptional()
  @IsEnum(DocumentCategory)
  category?: DocumentCategory;
}

export class DocumentFileDto {
  @ApiProperty() id!: string;
  @ApiProperty() version!: number;
  @ApiProperty() fileName!: string;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
  @ApiProperty() uploadedAt!: Date;
}

export class DocumentParticipantDto {
  @ApiProperty() userId!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty({ enum: DocumentParticipantRole }) participantRole!: DocumentParticipantRole;
}

export class DocumentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() engagementId!: string;
  @ApiPropertyOptional() requestClassId?: number | null;
  @ApiPropertyOptional() requestClassName?: string | null;
  @ApiPropertyOptional() requestId?: string | null;
  @ApiProperty() departmentId!: number;
  @ApiProperty({ enum: DocumentCategory }) category!: DocumentCategory;
  @ApiPropertyOptional({ enum: EngagementPhase }) phase?: EngagementPhase | null;
  @ApiProperty() title!: string;
  @ApiPropertyOptional() description?: string | null;
  @ApiProperty({ enum: DocumentStatus }) status!: DocumentStatus;
  @ApiProperty() currentVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class DocumentDetailResponseDto extends DocumentResponseDto {
  @ApiProperty({ type: [DocumentFileDto] }) files!: DocumentFileDto[];
  @ApiProperty({ type: [DocumentParticipantDto] }) participants!: DocumentParticipantDto[];
}

export class DocumentListResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] }) data!: DocumentResponseDto[];
  @ApiProperty() meta!: PageMeta;
}

export class PresignedUploadResponseDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty() method!: string;
  @ApiProperty() headers!: Record<string, string>;
  @ApiProperty() expiresIn!: number;
}

export class DownloadUrlResponseDto {
  @ApiProperty() url!: string;
}
