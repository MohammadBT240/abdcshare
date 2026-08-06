import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class MultipartCreateDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
  @ApiPropertyOptional({ description: 'Declared size for cap checks (bytes).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;
  /** Submissions only: replace a Returned file (append-only). */
  @ApiPropertyOptional() @IsOptional() @IsUUID() replacesFileId?: string;
}

export class MultipartCreateResponseDto {
  @ApiProperty() storageKey!: string;
  @ApiProperty() uploadId!: string;
}

export class MultipartSignPartsDto {
  @ApiProperty({ description: 'Object key returned by multipart create.' })
  @IsString()
  storageKey!: string;

  @ApiProperty({ type: [Number], description: '1-based part numbers to sign.' })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(10_000, { each: true })
  partNumbers!: number[];
}

export class MultipartSignedPartDto {
  @ApiProperty() partNumber!: number;
  @ApiProperty() url!: string;
}

export class MultipartSignPartsResponseDto {
  @ApiProperty({ type: [MultipartSignedPartDto] }) parts!: MultipartSignedPartDto[];
}

export class MultipartCompletedPartDto {
  @ApiProperty() @IsInt() @Min(1) partNumber!: number;
  @ApiProperty() @IsString() etag!: string;
}

export class MultipartCompleteDto {
  @ApiProperty() @IsString() storageKey!: string;
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) mimeType?: string;
  @ApiProperty() @IsInt() @Min(0) sizeBytes!: number;
  @ApiProperty({ type: [MultipartCompletedPartDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MultipartCompletedPartDto)
  parts!: MultipartCompletedPartDto[];
  /** Submissions only: replace a Returned file (append-only). */
  @ApiPropertyOptional() @IsOptional() @IsUUID() replacesFileId?: string;
}

export class MultipartAbortDto {
  @ApiProperty() @IsString() storageKey!: string;
}
