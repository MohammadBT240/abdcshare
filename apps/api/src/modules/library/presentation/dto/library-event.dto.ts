import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LibraryEventAction } from '@abdcshare/shared';

export class LibraryEventQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page.' })
  @IsOptional() @IsString() @MaxLength(200) cursor?: string;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class LibraryEventDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: LibraryEventAction }) action!: LibraryEventAction;
  @ApiPropertyOptional({ nullable: true }) actor!: { id: string; name: string } | null;
  @ApiPropertyOptional({ nullable: true }) collection!: { id: string; title: string } | null;
  @ApiProperty({ type: 'object', additionalProperties: true }) metadata!: Record<string, unknown>;
  @ApiProperty() createdAt!: Date;
}

export class LibraryEventListDto {
  @ApiProperty({ type: [LibraryEventDto] }) data!: LibraryEventDto[];
  @ApiPropertyOptional({ nullable: true }) nextCursor!: string | null;
}

export class LibraryEventSummaryDto {
  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } }) counts!: Record<string, number>;
}
