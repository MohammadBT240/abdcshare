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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@abdcshare/shared';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import { CompanyProfileService } from './company-profile.service';
import {
  CompanyProfileConfirmDto,
  CompanyProfileDownloadDto,
  CompanyProfileListQueryDto,
  CompanyProfilePresignDto,
  CompanyProfilePreviewDto,
  CompanyProfileResponseDto,
  CreateCompanyProfileDto,
  PresignedUploadResponseDto,
  RenameCompanyProfileDto,
} from './presentation/dto/company-profile.dto';

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
  create(
    @Body() dto: CreateCompanyProfileDto,
    @CurrentUser('userId') userId: string,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.createDraft(dto, userId);
  }

  @Post(':id/files/presign')
  @RequirePermission('company-profile:manage')
  presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompanyProfilePresignDto,
  ): Promise<PresignedUploadResponseDto> {
    return this.companyProfile.presignUpload(id, dto);
  }

  @Post(':id/files')
  @RequirePermission('company-profile:manage')
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompanyProfileConfirmDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.confirmUpload(id, dto);
  }

  @Post(':id/files/multipart')
  @RequirePermission('company-profile:manage')
  createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
  ) {
    return this.companyProfile.createMultipart(id, dto);
  }

  @Post(':id/files/multipart/:uploadId/parts')
  @RequirePermission('company-profile:manage')
  signMultipartParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
  ) {
    return this.companyProfile.signMultipartParts(id, uploadId, dto);
  }

  @Post(':id/files/multipart/:uploadId/complete')
  @RequirePermission('company-profile:manage')
  completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartCompleteDto,
  ): Promise<CompanyProfileResponseDto> {
    return this.companyProfile.completeMultipart(id, uploadId, dto);
  }

  @Post(':id/files/multipart/:uploadId/abort')
  @RequirePermission('company-profile:manage')
  abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
  ) {
    return this.companyProfile.abortMultipart(id, uploadId, dto);
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
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.companyProfile.remove(id);
  }
}
