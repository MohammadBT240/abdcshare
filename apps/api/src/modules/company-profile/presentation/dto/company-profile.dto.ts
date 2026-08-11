import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CompanyProfileListQueryDto extends PaginationQueryDto {}

export class CreateCompanyProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}

export class RenameCompanyProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;
}

export class CompanyProfilePresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class CompanyProfileConfirmDto {
  @ApiProperty({ description: 'The storageKey returned by the presign step.' })
  @IsString()
  storageKey!: string;

  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
}

export class CompanyProfileResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) fileName?: string | null;
  @ApiPropertyOptional() mimeType?: string | null;
  @ApiPropertyOptional() sizeBytes?: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() createdById?: string | null;
  @ApiPropertyOptional() createdByName?: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class CompanyProfileDownloadDto {
  @ApiProperty() url!: string;
}

export class CompanyProfilePreviewDto {
  @ApiPropertyOptional({ nullable: true }) url!: string | null;
  @ApiProperty({ enum: ['native', 'converted', 'unavailable'] })
  mode!: 'native' | 'converted' | 'unavailable';
  @ApiProperty() previewStatus!: string;
  @ApiPropertyOptional({ enum: ['pending', 'failed', 'unsupported'] })
  reason?: 'pending' | 'failed' | 'unsupported';
}

export class PresignedUploadResponseDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty({ enum: ['PUT'] }) method!: 'PUT';
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  headers!: Record<string, string>;
  @ApiProperty() expiresIn!: number;
}
