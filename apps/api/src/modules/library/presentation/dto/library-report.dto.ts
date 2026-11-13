import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { LibraryReportOutcome, LibraryReportReason, LibraryReportStatus } from '@abdcshare/shared';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class CreateLibraryReportDto {
  @ApiProperty({ enum: LibraryReportReason }) @IsEnum(LibraryReportReason) reason!: LibraryReportReason;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) note?: string | null;
}

export class LibraryReportListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: LibraryReportStatus, default: LibraryReportStatus.Open })
  @IsOptional() @IsIn(Object.values(LibraryReportStatus)) status?: LibraryReportStatus;
}

export class ResolveLibraryReportDto {
  @ApiProperty({ enum: LibraryReportOutcome }) @IsEnum(LibraryReportOutcome) outcome!: LibraryReportOutcome;

  @ApiPropertyOptional({ type: [Number], description: 'Required for Restrict.' })
  @IsOptional() @IsArray() @ArrayMaxSize(50) @IsInt({ each: true }) @Min(1, { each: true })
  departmentIds?: number[];

  @ApiPropertyOptional({ description: 'Shown to the reporter(s).' })
  @IsOptional() @IsString() @MaxLength(2000) note?: string | null;
}

export class LibraryReportEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LibraryReportReason }) reason!: LibraryReportReason;
  @ApiPropertyOptional({ nullable: true }) note!: string | null;
  @ApiProperty() reporter!: { id: string; name: string };
  @ApiProperty({ enum: LibraryReportStatus }) status!: LibraryReportStatus;
  @ApiPropertyOptional({ enum: LibraryReportOutcome, nullable: true }) outcome!: LibraryReportOutcome | null;
  @ApiPropertyOptional({ nullable: true }) resolution!: string | null;
  @ApiPropertyOptional({ nullable: true }) resolvedBy!: { id: string; name: string } | null;
  @ApiPropertyOptional({ nullable: true }) resolvedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
}

/** Reports grouped by item (D20). */
export class LibraryReportGroupDto {
  @ApiProperty() itemId!: string | null;
  @ApiProperty() itemTitle!: string;
  @ApiPropertyOptional({ nullable: true }) item!: {
    status: string;
    visibility: string;
    uploadedBy: { id: string; name: string };
    departments: { id: number; name: string }[];
  } | null;
  @ApiProperty() latestAt!: Date;
  @ApiProperty({ type: [LibraryReportEntryDto] }) reports!: LibraryReportEntryDto[];
}

export class LibraryReportCountDto {
  @ApiProperty() open!: number;
}
