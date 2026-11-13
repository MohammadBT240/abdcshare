import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, type RequestMeta } from '../../common/decorators/request-meta.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { LibraryService } from './library.service';
import { LibraryAdminService } from './library-admin.service';
import {
  LibraryAttentionDto,
  LibraryDuplicateGroupDto,
  LibraryTransferAllDto,
  LibraryTransferDto,
  LibraryTransferResultDto,
} from './presentation/dto/library-admin.dto';

/** Curator tools (S3): needs attention, duplicates, ownership transfer. */
@ApiTags('library')
@ApiBearerAuth()
@Controller('library/admin')
export class LibraryAdminController {
  constructor(
    private readonly library: LibraryService,
    private readonly admin: LibraryAdminService,
  ) {}

  @Get('attention')
  @RequirePermission('library:curate')
  async attention(@CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryAttentionDto> {
    return this.admin.attention(await this.library.viewer(user, meta));
  }

  @Get('duplicates')
  @RequirePermission('library:curate')
  async duplicates(@CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryDuplicateGroupDto[]> {
    return this.admin.duplicateGroups(await this.library.viewer(user, meta));
  }

  @Get('departments/:id/impact')
  @RequirePermission('library:curate')
  async departmentImpact(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ items: number; collections: number }> {
    return this.admin.departmentImpact(id, await this.library.viewer(user, meta));
  }

  @Post('items/:id/transfer')
  @RequirePermission('library:curate')
  async transferItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryTransferResultDto> {
    return this.admin.transferItem(id, dto.userId, await this.library.viewer(user, meta));
  }

  @Post('collections/:id/transfer')
  @RequirePermission('library:curate')
  async transferCollection(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LibraryTransferDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryTransferResultDto> {
    return this.admin.transferCollection(id, dto.userId, await this.library.viewer(user, meta));
  }

  @Post('transfer-all')
  @RequirePermission('library:curate')
  async transferAll(
    @Body() dto: LibraryTransferAllDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<LibraryTransferResultDto> {
    return this.admin.transferAll(dto.fromUserId, dto.toUserId, await this.library.viewer(user, meta));
  }
}
