import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ClientContactDto } from './create-client.dto';

export class CreateClientContactDto extends ClientContactDto {}

export class UpdateClientContactDto extends PartialType(
  OmitType(ClientContactDto, [] as const),
) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ClientContactResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() middleName?: string | null;
  @ApiProperty() surname!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiPropertyOptional() phoneNumber?: string | null;
  @ApiPropertyOptional() titleId?: number | null;
  @ApiProperty() isPrimary!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiPropertyOptional() avatarUrl?: string | null;
  @ApiProperty() createdAt!: Date;
}
