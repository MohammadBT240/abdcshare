import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateHelpCategoryDto {
  @ApiProperty() @IsString() @MaxLength(150) name!: string;
  @ApiProperty() @IsString() @MaxLength(150) slug!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
}

export class UpdateHelpCategoryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) slug?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) order?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) icon?: string;
}

export class HelpCategoryResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() order!: number;
  @ApiPropertyOptional() icon?: string | null;
}
