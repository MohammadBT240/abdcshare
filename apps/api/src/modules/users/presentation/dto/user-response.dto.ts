import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PageMeta, PartnerDesignation } from '@abdcshare/shared';

export class UserResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() firstName!: string;
  @ApiPropertyOptional() middleName?: string | null;
  @ApiProperty() surname!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiPropertyOptional({ enum: ['PrincipalPartner', 'Partner'], nullable: true })
  partnerDesignation?: PartnerDesignation | null;
  @ApiPropertyOptional() departmentId?: number | null;
  @ApiPropertyOptional() phoneNumber?: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiProperty() createdAt!: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] }) data!: UserResponseDto[];
  @ApiProperty() meta!: PageMeta;
}
