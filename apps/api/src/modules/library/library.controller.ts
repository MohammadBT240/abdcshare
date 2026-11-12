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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import {
  MultipartAbortDto,
  MultipartCompleteDto,
  MultipartCreateDto,
  MultipartSignPartsDto,
} from '../../common/storage/multipart.dto';
import { LibraryService } from './library.service';
import {
  CreateLibraryItemDto,
  LibraryConfirmDto,
  LibraryDownloadDto,
  LibraryItemListQueryDto,
  LibraryItemResponseDto,
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
  constructor(private readonly library: LibraryService) {}

  @Get('items')
  @RequirePermission('library:view')
  async list(
    @Query() query: LibraryItemListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<LibraryItemResponseDto>> {
    return this.library.list(query, await this.library.viewer(user));
  }

  @Get('tags')
  @RequirePermission('library:view')
  async tags(
    @Query() query: LibraryTagQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Paginated<LibraryTagDto>> {
    return this.library.tags(query, await this.library.viewer(user));
  }

  @Post('items')
  @RequirePermission('library:contribute')
  async create(
    @Body() dto: CreateLibraryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.create(dto, await this.library.viewer(user));
  }

  @Get('items/:id')
  @RequirePermission('library:view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.get(id, await this.library.viewer(user));
  }

  @Patch('items/:id')
  @RequirePermission('library:contribute')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.update(id, dto, await this.library.viewer(user));
  }

  // ---- file upload (presign < 50 MB, multipart above) ----

  @Post('items/:id/files/presign')
  @RequirePermission('library:contribute')
  async presign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryPresignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryPresignedUploadDto> {
    return this.library.presignUpload(id, dto, await this.library.viewer(user));
  }

  @Post('items/:id/files')
  @RequirePermission('library:contribute')
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryConfirmDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.confirmUpload(id, dto, await this.library.viewer(user));
  }

  @Post('items/:id/files/multipart')
  @RequirePermission('library:contribute')
  async createMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MultipartCreateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.library.createMultipart(id, dto, await this.library.viewer(user));
  }

  @Post('items/:id/files/multipart/:uploadId/parts')
  @RequirePermission('library:contribute')
  async signMultipartParts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartSignPartsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.library.signMultipartParts(id, uploadId, dto, await this.library.viewer(user));
  }

  @Post('items/:id/files/multipart/:uploadId/complete')
  @RequirePermission('library:contribute')
  async completeMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartCompleteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.completeMultipart(id, uploadId, dto, await this.library.viewer(user));
  }

  @Post('items/:id/files/multipart/:uploadId/abort')
  @RequirePermission('library:contribute')
  async abortMultipart(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('uploadId') uploadId: string,
    @Body() dto: MultipartAbortDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.library.abortMultipart(id, uploadId, dto, await this.library.viewer(user));
  }

  // ---- lifecycle ----

  @Post('items/:id/archive')
  @RequirePermission('library:contribute')
  async archive(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.archive(id, await this.library.viewer(user));
  }

  @Post('items/:id/restore')
  @RequirePermission('library:contribute')
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryItemResponseDto> {
    return this.library.restore(id, await this.library.viewer(user));
  }

  @Delete('items/:id')
  @HttpCode(204)
  @RequirePermission('library:curate')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.library.remove(id, await this.library.viewer(user));
  }

  // ---- reading ----

  @Get('items/:id/preview')
  @RequirePermission('library:view')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LibraryPreviewQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryPreviewDto> {
    return this.library.preview(id, await this.library.viewer(user), { retry: query.retry });
  }

  @Get('items/:id/download')
  @RequirePermission('library:view')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LibraryDownloadDto> {
    return this.library.download(id, await this.library.viewer(user));
  }
}
