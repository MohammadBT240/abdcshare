import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiPropertyOptional({ enum: ['PrincipalPartner', 'Partner'], nullable: true })
  partnerDesignation?: 'PrincipalPartner' | 'Partner' | null;
}

export class AuthTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
