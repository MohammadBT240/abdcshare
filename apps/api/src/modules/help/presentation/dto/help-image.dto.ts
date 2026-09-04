import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

/** Browser → API upload, same shape as AvatarUploadDto (avoids R2 CORS issues). */
export class HelpImageUploadDto {
  @ApiProperty() @IsString() @MaxLength(255) fileName!: string;
  @ApiProperty() @IsString() @MaxLength(150) contentType!: string;
  @ApiProperty({ description: 'Base64-encoded image bytes.' }) @IsString() data!: string;
}

export class HelpImageUploadResponseDto {
  @ApiProperty() storageKey!: string;
}
