import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() titleId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) middleName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) surname?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() genderId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() maritalStatusId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) phoneNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() officialAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() residentialAddress?: string;
}

export class AvatarPresignDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
}

export class AvatarConfirmDto {
  @ApiProperty({ description: 'The storageKey returned by the presign step.' })
  @IsString() storageKey!: string;
}

/** Browser → API upload (avoids direct-to-bucket CORS issues). */
export class AvatarUploadDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
  @ApiProperty({ description: 'Base64-encoded image bytes (no data: URL prefix).' })
  @IsString()
  data!: string;
}

export class MeResponseDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() titleId?: number | null;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() middleName?: string | null;
  @ApiProperty() surname!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiPropertyOptional() partnerDesignation?: string | null;
  @ApiPropertyOptional() departmentId?: number | null;
  @ApiPropertyOptional() genderId?: number | null;
  @ApiPropertyOptional() maritalStatusId?: number | null;
  @ApiPropertyOptional() phoneNumber?: string | null;
  @ApiPropertyOptional() officialAddress?: string | null;
  @ApiPropertyOptional() residentialAddress?: string | null;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
}
