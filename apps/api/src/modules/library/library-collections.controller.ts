import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@abdcshare/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, type RequestMeta } from '../../common/decorators/request-meta.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { LibraryService } from './library.service';
import { LibraryCollectionsService } from './library-collections.service';
import {
  AddCollectionItemsDto,
  CreateLibraryCollectionDto,
  LibraryCollectionItemDto,
  LibraryCollectionItemsQueryDto,
  LibraryCollectionListQueryDto,
  LibraryCollectionResponseDto,
  ReorderCollectionItemsDto,
  UpdateLibraryCollectionDto,
} from './presentation/dto/library-collection.dto';

@ApiTags('library')
@ApiBearerAuth()
@Controller('library/collections')
export class LibraryCollectionsController {
  constructor(
    private readonly collections: LibraryCollectionsService,
    private readonly library: LibraryService,
  ) {}

  @Get()
  @RequirePermission('library:view')
  async list(
    @Query() query: LibraryCollectionListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Paginated<LibraryCollectionResponseDto>> {
    return this.collections.list(query, await this.library.viewer(user, meta));
  }

  @Post()
  @RequirePermission('library:contribute')
  async create(@Body() dto: CreateLibraryCollectionDto, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryCollectionResponseDto> {
    return this.collections.create(dto, await this.library.viewer(user, meta));
  }

  @Get(':id')
  @RequirePermission('library:view')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryCollectionResponseDto> {
    return this.collections.get(id, await this.library.viewer(user, meta));
  }

  @Patch(':id')
  @RequirePermission('library:contribute')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryCollectionDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryCollectionResponseDto> {
    return this.collections.update(id, dto, await this.library.viewer(user, meta));
  }

  @Post(':id/archive')
  @RequirePermission('library:contribute')
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryCollectionResponseDto> {
    return this.collections.archive(id, await this.library.viewer(user, meta));
  }

  @Post(':id/restore')
  @RequirePermission('library:contribute')
  async restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryCollectionResponseDto> {
    return this.collections.restore(id, await this.library.viewer(user, meta));
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('library:contribute')
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<void> {
    return this.collections.remove(id, await this.library.viewer(user, meta));
  }

  @Get(':id/items')
  @RequirePermission('library:view')
  async items(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: LibraryCollectionItemsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Paginated<LibraryCollectionItemDto>> {
    return this.collections.items(id, query, await this.library.viewer(user, meta));
  }

  @Post(':id/items')
  @RequirePermission('library:contribute')
  async addItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCollectionItemsDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ added: number }> {
    return this.collections.addItems(id, dto, await this.library.viewer(user, meta));
  }

  @Put(':id/items/order')
  @RequirePermission('library:contribute')
  async reorder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderCollectionItemsDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ ok: true }> {
    return this.collections.reorder(id, dto, await this.library.viewer(user, meta));
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @RequirePermission('library:contribute')
  async removeItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<void> {
    return this.collections.removeItem(id, itemId, await this.library.viewer(user, meta));
  }

  @Post(':id/export')
  @HttpCode(202)
  @RequirePermission('library:view')
  async export(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<{ accepted: true; files: number }> {
    return this.collections.requestExport(id, await this.library.viewer(user, meta));
  }

  @Get(':id/exports/download')
  @RequirePermission('library:view')
  async exportDownload(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('key') key: string | undefined,
    @Query('name') name: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ url: string }> {
    if (!key?.trim()) throw new BadRequestException('key query required');
    return this.collections.exportDownloadUrl(id, key.trim(), name, await this.library.viewer(user, meta));
  }
}
