import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCompanyProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) logoPath?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
}

export class CompanyProfileResponseDto {
  @ApiProperty() id!: number;
  @ApiPropertyOptional() name?: string | null;
  @ApiPropertyOptional() logoPath?: string | null;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phone?: string | null;
  @ApiPropertyOptional() address?: string | null;
  @ApiPropertyOptional() updatedById?: string | null;
  @ApiProperty() updatedAt!: Date;
}
