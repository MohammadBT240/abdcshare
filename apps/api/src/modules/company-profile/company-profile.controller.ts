import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@abdcshare/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CompanyProfileService } from './company-profile.service';
import { COMPANY_PROFILE_MAX_BYTES } from './company-profile.constants';
import {
  CompanyProfileDownloadDto,
  CompanyProfileListQueryDto,
  CompanyProfilePreviewDto,
  CompanyProfileResponseDto,
  RenameCompanyProfileDto,
} from './presentation/dto/company-profile.dto';

const fileInterceptor = FileInterceptor('file', {
  limits: { fileSize: COMPANY_PROFILE_MAX_BYTES },
});

@ApiTags('company-profiles')
@ApiBearerAuth()
@Controller('company-profiles')
export class CompanyProfileController {
  constructor(private readonly companyProfile: CompanyProfileService) {}

  @Get()
  @RequirePermission('company-profile:view')
  list(
    @Query() query: CompanyProfileListQueryDto,
  ): Promise<Paginated<CompanyProfileResponseDto>> {
    return this.companyProfile.list(query);
  }

  @Post()
  @RequirePermission('company-profile:manage')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'file'],
      properties: {
        name: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(fileInterceptor)
  create(
    @Body('name') name: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('userId') userId: string,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.create(name, file, userId);
  }

  @Get(':id/download')
  @RequirePermission('company-profile:view')
  download(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyProfileDownloadDto> {
    return this.companyProfile.download(id);
  }

  @Get(':id/preview')
  @RequirePermission('company-profile:view')
  preview(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyProfilePreviewDto> {
    return this.companyProfile.preview(id);
  }

  @Post(':id/file')
  @RequirePermission('company-profile:manage')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(fileInterceptor)
  replaceFile(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.replaceFile(id, file);
  }

  @Get(':id')
  @RequirePermission('company-profile:view')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.get(id);
  }

  @Patch(':id')
  @RequirePermission('company-profile:manage')
  rename(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenameCompanyProfileDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.rename(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('company-profile:manage')
  softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.companyProfile.softDelete(id);
  }
}
