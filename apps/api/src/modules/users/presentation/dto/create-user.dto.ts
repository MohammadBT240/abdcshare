import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty() @IsString() @MaxLength(100) firstName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @ApiProperty() @IsString() @MaxLength(100) surname!: string;
  @ApiProperty() @IsEmail() email!: string;
  @ApiProperty() @IsInt() roleId!: number;

  @ApiPropertyOptional() @IsOptional() @IsInt() titleId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() genderId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maritalStatusId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() departmentId?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() clientId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) officialAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) residentialAddress?: string;

  @ApiPropertyOptional({ description: 'Optional; a temporary one is generated if omitted.' })
  @IsOptional() @IsString() @MinLength(8) password?: string;
}
