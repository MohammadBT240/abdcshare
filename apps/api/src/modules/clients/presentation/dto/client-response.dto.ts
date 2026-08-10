import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PageMeta } from '@abdcshare/shared';

export class ClientResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() clientType?: string | null;
  @ApiPropertyOptional() clientTypeId?: number | null;
  @ApiPropertyOptional() companyName?: string | null;
  @ApiPropertyOptional() companyRegisteredAddress?: string | null;
  @ApiPropertyOptional() incorporationDate?: Date | null;
  @ApiPropertyOptional() incorporationNo?: string | null;
  @ApiPropertyOptional() officialAddress?: string | null;
  @ApiPropertyOptional() residentialAddress?: string | null;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phoneNumber?: string | null;
  @ApiPropertyOptional({ description: 'Primary contact full name (login).' })
  primaryContactName?: string | null;
  @ApiPropertyOptional() primaryContactFirstName?: string | null;
  @ApiPropertyOptional() primaryContactSurname?: string | null;
  @ApiPropertyOptional({ description: 'Primary contact email (login username).' })
  primaryContactEmail?: string | null;
  @ApiPropertyOptional() primaryContactPhone?: string | null;
  @ApiPropertyOptional({ description: 'Primary contact user id (for avatar upload).' })
  primaryContactId?: string | null;
  @ApiPropertyOptional({ description: 'Presigned URL for the primary contact avatar.' })
  primaryContactAvatarUrl?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class ClientListResponseDto {
  @ApiProperty({ type: [ClientResponseDto] }) data!: ClientResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
