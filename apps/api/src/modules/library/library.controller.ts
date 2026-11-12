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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, type RequestMeta } from '../../common/decorators/request-meta.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import {
  MultipartAbortDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import { LibraryService } from './library.service';
import { LibraryEventsService } from './library-events.service';
import { LibraryReportsService } from './library-reports.service';
import { LibraryAdminService } from './library-admin.service';
import { LibraryDuplicateDto, LibraryDuplicateQueryDto } from './presentation/dto/library-admin.dto';
import { LibraryEventListDto, LibraryEventQueryDto, LibraryEventSummaryDto } from './presentation/dto/library-event.dto';
import { CreateLibraryReportDto, LibraryReportEntryDto } from './presentation/dto/library-report.dto';
import {
  CreateLibraryItemDto,
  LibraryConfirmDto,
  LibraryDownloadDto,
  LibraryItemListQueryDto,
  LibraryItemResponseDto,
  LibraryMultipartCompleteDto,
  LibraryPresignDto,
  LibraryPresignedUploadDto,
  LibraryPreviewDto,
  LibraryPreviewQueryDto,
  LibraryTagDto,
  LibraryTagQueryDto,
  UpdateLibraryItemDto,
} from './presentation/dto/library.dto';

/**
 * Staff knowledge library. Route permissions are coarse (view / contribute / curate);
 * per-item visibility and "own item" edit rights are enforced in {@link LibraryService}.
 */
@ApiTags('library')
@ApiBearerAuth()
@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly events: LibraryEventsService,
    private readonly reports: LibraryReportsService,
    private readonly admin: LibraryAdminService,
  ) {}

  @Get('items')
  @RequirePermission('library:view')
  async list(
    @Query() query: LibraryItemListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Paginated<LibraryItemResponseDto>> {
    return this.library.list(query, await this.library.viewer(user, meta));
  }

  @Get('tags')
  @RequirePermission('library:view')
  async tags(
    @Query() query: LibraryTagQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Paginated<LibraryTagDto>> {
    return this.library.tags(query, await this.library.viewer(user, meta));
  }

  @Post('items')
  @RequirePermission('library:contribute')
  async create(
    @Body() dto: CreateLibraryItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.create(dto, await this.library.viewer(user, meta));
  }

  /** Before uploading: visible items with the same file (S3, D27). Declared before `items/:id`. */
  @Get('items/duplicates')
  @RequirePermission('library:view')
  async duplicates(
    @Query() query: LibraryDuplicateQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryDuplicateDto[]> {
    return this.admin.duplicatesOf(query.hash, await this.library.viewer(user, meta));
  }

  @Get('items/:id')
  @RequirePermission('library:view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.get(id, await this.library.viewer(user, meta));
  }

  @Patch('items/:id')
  @RequirePermission('library:contribute')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryItemDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.update(id, dto, await this.library.viewer(user, meta));
  }

  // ---- file upload (presign < 50 MB, multipart above) ----

  @Post('items/:id/files/presign')
  @RequirePermission('library:contribute')
  async presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryPresignDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryPresignedUploadDto> {
    return this.library.presignUpload(id, dto, await this.library.viewer(user, meta));
  }

  @Post('items/:id/files')
  @RequirePermission('library:contribute')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.confirmUpload(id, dto, await this.library.viewer(user, meta));
  }

  @Post('items/:id/files/multipart')
  @RequirePermission('library:contribute')
  async createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.library.createMultipart(id, dto, await this.library.viewer(user, meta));
  }

  @Post('items/:id/files/multipart/:uploadId/parts')
  @RequirePermission('library:contribute')
  async signMultipartParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.library.signMultipartParts(id, uploadId, dto, await this.library.viewer(user, meta));
  }

  @Post('items/:id/files/multipart/:uploadId/complete')
  @RequirePermission('library:contribute')
  async completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: LibraryMultipartCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.completeMultipart(id, uploadId, dto, await this.library.viewer(user, meta));
  }

  @Post('items/:id/files/multipart/:uploadId/abort')
  @RequirePermission('library:contribute')
  async abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.library.abortMultipart(id, uploadId, dto, await this.library.viewer(user, meta));
  }

  // ---- lifecycle ----

  @Post('items/:id/archive')
  @RequirePermission('library:contribute')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.archive(id, await this.library.viewer(user, meta));
  }

  @Post('items/:id/restore')
  @RequirePermission('library:contribute')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryItemResponseDto> {
    return this.library.restore(id, await this.library.viewer(user, meta));
  }

  @Delete('items/:id')
  @HttpCode(204)
  @RequirePermission('library:curate')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.library.remove(id, await this.library.viewer(user, meta));
  }

  // ---- reading ----

  @Get('items/:id/preview')
  @RequirePermission('library:view')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LibraryPreviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryPreviewDto> {
    return this.library.preview(id, await this.library.viewer(user, meta), { retry: query.retry });
  }

  @Get('items/:id/download')
  @RequirePermission('library:view')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryDownloadDto> {
    return this.library.download(id, await this.library.viewer(user, meta));
  }

  // ---- activity (uploader + curators) & reports ----

  @Get('items/:id/events')
  @RequirePermission('library:view')
  async events_(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LibraryEventQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryEventListDto> {
    await this.library.assertCanSeeActivity(id, await this.library.viewer(user, meta));
    return this.events.forItem(id, query);
  }

  @Get('items/:id/events/summary')
  @RequirePermission('library:view')
  async eventSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryEventSummaryDto> {
    await this.library.assertCanSeeActivity(id, await this.library.viewer(user, meta));
    return { counts: await this.events.summary(id) };
  }

  @Post('items/:id/reports')
  @RequirePermission('library:view')
  async report(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateLibraryReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryReportEntryDto> {
    return this.reports.create(id, dto, await this.library.viewer(user, meta));
  }
}
