import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { FilePreviewStatus, LibraryItemStatus, LibraryVisibility } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import {
  LIBRARY_FILE_TYPES,
  LIBRARY_MAX_TAG_LENGTH,
  LIBRARY_MAX_TAGS,
  type LibraryFileType,
  type LibrarySort,
} from '../../library.constants';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' ? true : value === false || value === 'false' || value === '0' ? false : value;

// ---------------------------------------------------------------- categories

export class LibraryCategoryListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Include inactive categories (requires catalogue:manage).' })
  @IsOptional() @Transform(toBool) @IsBoolean()
  includeInactive?: boolean;
}

export class CreateLibraryCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiPropertyOptional({ description: 'Defaults to a slug of the name.' })
  @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}

export class UpdateLibraryCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100_000) sortOrder?: number;
}

export class LibraryCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty() sortOrder!: number;
  @ApiProperty() isActive!: boolean;
}

// ---------------------------------------------------------------- items

export class LibraryItemListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;

  @ApiPropertyOptional({ description: 'Items in this collection.' })
  @IsOptional() @IsUUID() collectionId?: string;

  @ApiPropertyOptional({ description: 'Items restricted to this department.' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) departmentId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(LIBRARY_MAX_TAG_LENGTH) tag?: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;

  @ApiPropertyOptional({ enum: LIBRARY_FILE_TYPES })
  @IsOptional() @IsIn(LIBRARY_FILE_TYPES as unknown as string[]) fileType?: LibraryFileType;

  @ApiPropertyOptional({ description: 'Only items I uploaded.' })
  @IsOptional() @Transform(toBool) @IsBoolean() mine?: boolean;

  @ApiPropertyOptional({
    enum: [LibraryItemStatus.Published, LibraryItemStatus.Archived],
    description: 'Archived: curators, or with mine=true.',
  })
  @IsOptional() @IsIn([LibraryItemStatus.Published, LibraryItemStatus.Archived])
  status?: LibraryItemStatus.Published | LibraryItemStatus.Archived;

  /** Narrowed from the base `sort` (string); allow-listed in the service against LIBRARY_SORTS. */
  declare sort?: LibrarySort;
}

class LibraryItemFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) authors?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1900) @Max(2100) publishedYear?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) source?: string | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(LIBRARY_MAX_TAGS)
  @IsString({ each: true }) @MaxLength(LIBRARY_MAX_TAG_LENGTH, { each: true })
  tags?: string[];

  @ApiPropertyOptional({ enum: LibraryVisibility })
  @IsOptional() @IsEnum(LibraryVisibility) visibility?: LibraryVisibility;

  @ApiPropertyOptional({ type: [Number], description: 'Required (≥1) when visibility = Departments.' })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) @Min(1, { each: true })
  departmentIds?: number[];
}

export class CreateLibraryItemDto extends LibraryItemFieldsDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title!: string;
  @ApiProperty() @IsUUID() categoryId!: string;

  @ApiPropertyOptional({ description: 'Add the new item to this collection (needs edit rights on it).' })
  @IsOptional() @IsUUID() collectionId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) section?: string | null;
}

export class UpdateLibraryItemDto extends LibraryItemFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
}

export class LibraryPresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class LibraryConfirmDto {
  @ApiProperty({ description: 'The storageKey returned by presign / multipart create.' })
  @IsString() @MaxLength(255) storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
}

export class LibraryRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
}

export class LibraryDepartmentRefDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
}

export class LibraryItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiProperty({ type: LibraryRefDto }) category!: LibraryRefDto;
  @ApiPropertyOptional({ nullable: true }) authors!: string | null;
  @ApiPropertyOptional({ nullable: true }) publishedYear!: number | null;
  @ApiPropertyOptional({ nullable: true }) source!: string | null;
  @ApiProperty({ type: [String] }) tags!: string[];
  @ApiProperty({ enum: LibraryVisibility }) visibility!: LibraryVisibility;
  @ApiProperty({ type: [LibraryDepartmentRefDto] }) departments!: LibraryDepartmentRefDto[];
  @ApiProperty({ enum: LibraryItemStatus }) status!: LibraryItemStatus;
  @ApiPropertyOptional({ nullable: true }) fileName!: string | null;
  @ApiPropertyOptional({ nullable: true }) mimeType!: string | null;
  @ApiPropertyOptional({ nullable: true }) sizeBytes!: number | null;
  @ApiPropertyOptional({ nullable: true, enum: LIBRARY_FILE_TYPES }) fileType!: LibraryFileType | null;
  @ApiProperty({ enum: FilePreviewStatus }) previewStatus!: FilePreviewStatus;
  @ApiProperty({ type: LibraryRefDto }) uploadedBy!: LibraryRefDto;
  @ApiPropertyOptional({ nullable: true }) publishedAt!: Date | null;
  @ApiPropertyOptional({ nullable: true }) archivedAt!: Date | null;
  @ApiProperty() viewCount!: number;
  @ApiProperty() downloadCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty({ description: 'Collections (visible to the viewer) this item belongs to.' })
  collections!: { id: string; title: string; type: string; section: string | null }[];
  @ApiProperty({ description: 'Viewer may edit metadata, replace the file, archive/restore.' })
  canEdit!: boolean;
  @ApiProperty({ description: 'Viewer may permanently delete (curators, archived items).' })
  canDelete!: boolean;
}

export class LibraryDownloadDto {
  @ApiProperty() url!: string;
}

export class LibraryPreviewQueryDto {
  @ApiPropertyOptional({ description: 'Re-queue a Failed Office conversion (editors only).' })
  @IsOptional() @Transform(toBool) @IsBoolean() retry?: boolean;
}

export class LibraryPreviewDto {
  @ApiPropertyOptional({ nullable: true }) url!: string | null;
  @ApiProperty({ enum: ['native', 'converted', 'unavailable'] })
  mode!: 'native' | 'converted' | 'unavailable';
  @ApiProperty({ enum: FilePreviewStatus }) previewStatus!: FilePreviewStatus;
  @ApiPropertyOptional({ enum: ['pending', 'failed', 'unsupported'] })
  reason?: 'pending' | 'failed' | 'unsupported';
}

export class LibraryTagQueryDto extends PaginationQueryDto {}

export class LibraryTagDto {
  @ApiProperty() tag!: string;
  @ApiProperty() count!: number;
}

export class LibraryPresignedUploadDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() uploadUrl!: string;
  @ApiProperty({ enum: ['PUT'] }) method!: 'PUT';
  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  headers!: Record<string, string>;
  @ApiProperty() expiresIn!: number;
}
