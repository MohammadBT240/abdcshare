import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() email!: string;
  @ApiProperty() role!: string;
  @ApiProperty() mustChangePassword!: boolean;
  @ApiPropertyOptional({ enum: ['PrincipalPartner', 'Partner'], nullable: true })
  partnerDesignation?: 'PrincipalPartner' | 'Partner' | null;
  /** Staff/Client on the Chairman roster — effective partner-report:submit + view. */
  @ApiProperty() partnerReportAllowed!: boolean;
  @ApiPropertyOptional({ nullable: true }) avatarUrl?: string | null;
}

export class AuthTokensDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
  @ApiProperty({ type: AuthUserDto }) user!: AuthUserDto;
}
