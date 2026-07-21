import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import type { PartnerDesignation } from '@abdcshare/shared';

export class AssignDesignationDto {
  @ApiPropertyOptional({ enum: ['PrincipalPartner', 'Partner'], nullable: true })
  @IsOptional()
  @IsIn(['PrincipalPartner', 'Partner'])
  designation?: PartnerDesignation | null;
}
