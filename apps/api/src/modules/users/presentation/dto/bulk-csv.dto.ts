import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class BulkCsvDto {
  @ApiProperty({ description: 'Raw CSV content (header row + data rows).' })
  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  csv!: string;
}
