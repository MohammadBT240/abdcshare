import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
  ValidateNested,
} from 'class-validator';
import { LibraryCollectionStatus, LibraryCollectionType, LibraryVisibility } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';
import { LibraryDepartmentRefDto, LibraryItemResponseDto, LibraryRefDto } from './library.dto';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' ? true : value === false || value === 'false' || value === '0' ? false : value;

export class LibraryCollectionListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LibraryCollectionType })
  @IsOptional() @IsEnum(LibraryCollectionType) type?: LibraryCollectionType;

  @ApiPropertyOptional({ description: 'Year the collection started (starts_on).' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100) year?: number;

  @ApiPropertyOptional({ description: 'Only collections I own.' })
  @IsOptional() @Transform(toBool) @IsBoolean() mine?: boolean;

  @ApiPropertyOptional({ description: 'Only collections I can add items to (owner, or any for curators).' })
  @IsOptional() @Transform(toBool) @IsBoolean() editable?: boolean;

  @ApiPropertyOptional({ enum: LibraryCollectionStatus })
  @IsOptional() @IsIn([LibraryCollectionStatus.Active, LibraryCollectionStatus.Archived])
  status?: LibraryCollectionStatus;
}

class CollectionFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string | null;
  @ApiPropertyOptional({ example: '2026-03-10' }) @IsOptional() @IsDateString({ strict: true }) startsOn?: string | null;
  @ApiPropertyOptional({ example: '2026-03-12' }) @IsOptional() @IsDateString({ strict: true }) endsOn?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) facilitator?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) venue?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) externalUrl?: string | null;
  @ApiPropertyOptional({ enum: LibraryVisibility }) @IsOptional() @IsEnum(LibraryVisibility) visibility?: LibraryVisibility;
  @ApiPropertyOptional({ type: [Number] })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) @Min(1, { each: true })
  departmentIds?: number[];
}

export class CreateLibraryCollectionDto extends CollectionFieldsDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title!: string;
  @ApiProperty({ enum: LibraryCollectionType }) @IsEnum(LibraryCollectionType) type!: LibraryCollectionType;
}

export class UpdateLibraryCollectionDto extends CollectionFieldsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(200) title?: string;
  @ApiPropertyOptional({ enum: LibraryCollectionType }) @IsOptional() @IsEnum(LibraryCollectionType) type?: LibraryCollectionType;
}

export class AddCollectionItemsDto {
  @ApiProperty({ type: [String] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @IsUUID('4', { each: true })
  itemIds!: string[];

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) section?: string | null;
}

export class CollectionOrderEntryDto {
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) section?: string | null;
}

export class ReorderCollectionItemsDto {
  @ApiProperty({ type: [CollectionOrderEntryDto] })
  @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => CollectionOrderEntryDto)
  items!: CollectionOrderEntryDto[];
}

export class LibraryCollectionResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: LibraryCollectionType }) type!: LibraryCollectionType;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true }) startsOn!: string | null;
  @ApiPropertyOptional({ nullable: true }) endsOn!: string | null;
  @ApiPropertyOptional({ nullable: true }) facilitator!: string | null;
  @ApiPropertyOptional({ nullable: true }) venue!: string | null;
  @ApiPropertyOptional({ nullable: true }) externalUrl!: string | null;
  @ApiProperty({ enum: LibraryVisibility }) visibility!: LibraryVisibility;
  @ApiProperty({ type: [LibraryDepartmentRefDto] }) departments!: LibraryDepartmentRefDto[];
  @ApiProperty({ enum: LibraryCollectionStatus }) status!: LibraryCollectionStatus;
  @ApiProperty({ type: LibraryRefDto }) owner!: LibraryRefDto;
  @ApiProperty({ description: 'Items in it that the viewer can see.' }) itemCount!: number;
  @ApiProperty({ description: "Items in it the viewer can't see (count only)." }) hiddenItemCount!: number;
  @ApiPropertyOptional({ nullable: true }) archivedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiProperty() canEdit!: boolean;
  @ApiProperty() canDelete!: boolean;
}

export class LibraryCollectionItemDto {
  @ApiProperty() position!: number;
  @ApiPropertyOptional({ nullable: true }) section!: string | null;
  @ApiProperty({ type: LibraryItemResponseDto }) item!: LibraryItemResponseDto;
}

export class LibraryCollectionItemsQueryDto extends PaginationQueryDto {}

export class LibraryCollectionRefDto {
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: LibraryCollectionType }) type!: LibraryCollectionType;
  @ApiPropertyOptional({ nullable: true }) section!: string | null;
}
