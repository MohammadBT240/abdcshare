import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompanyProfileService } from './company-profile.service';
import {
  CompanyProfileResponseDto,
  UpdateCompanyProfileDto,
} from './presentation/dto/company-profile.dto';

@ApiTags('company-profile')
@ApiBearerAuth()
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly companyProfile: CompanyProfileService) {}

  @Get()
  @RequirePermission('company-profile:view')
  get(): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.get();
  }

  @Patch()
  @RequirePermission('company-profile:manage')
  update(
    @Body() dto: UpdateCompanyProfileDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.update(dto, userId);
  }
}
