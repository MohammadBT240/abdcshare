import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) middleName?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) surname?: string;
  /** @deprecated Prefer firstName/middleName/surname — kept for older clients. */
  @ApiPropertyOptional() @IsOptional() @IsString() fullName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() roleId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() titleId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() genderId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() maritalStatusId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() departmentId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) officialAddress?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) residentialAddress?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
