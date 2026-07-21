import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PageMeta } from '@abdcshare/shared';

export class ClientResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() clientType?: string | null;
  @ApiPropertyOptional() companyName?: string | null;
  @ApiPropertyOptional() incorporationNo?: string | null;
  @ApiPropertyOptional() email?: string | null;
  @ApiPropertyOptional() phoneNumber?: string | null;
  @ApiPropertyOptional({ description: 'Primary contact full name (login).' })
  primaryContactName?: string | null;
  @ApiPropertyOptional({ description: 'Primary contact email (login username).' })
  primaryContactEmail?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class ClientListResponseDto {
  @ApiProperty({ type: [ClientResponseDto] }) data!: ClientResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
