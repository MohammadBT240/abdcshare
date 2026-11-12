import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Paginated } from '@abdcshare/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ReqMeta, type RequestMeta } from '../../common/decorators/request-meta.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { LibraryService } from './library.service';
import { LibraryReportsService } from './library-reports.service';
import {
  LibraryReportCountDto,
  LibraryReportGroupDto,
  LibraryReportListQueryDto,
  ResolveLibraryReportDto,
} from './presentation/dto/library-report.dto';

/** Curator review queue (S2, D20). Reporting itself lives on the item routes. */
@ApiTags('library')
@ApiBearerAuth()
@Controller('library/reports')
export class LibraryReportsController {
  constructor(
    private readonly library: LibraryService,
    private readonly reports: LibraryReportsService,
  ) {}

  @Get()
  @RequirePermission('library:curate')
  async list(
    @Query() query: LibraryReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<Paginated<LibraryReportGroupDto>> {
    return this.reports.list(query, await this.library.viewer(user, meta));
  }

  /** Sidebar badge: items with open reports. 0 for non-curators (no 403 so the shell can always ask). */
  @Get('count')
  @RequirePermission('library:view')
  async count(@CurrentUser() user: AuthenticatedUser, @ReqMeta() meta: RequestMeta): Promise<LibraryReportCountDto> {
    return this.reports.count(await this.library.viewer(user, meta));
  }

  @Post(':id/resolve')
  @RequirePermission('library:curate')
  async resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveLibraryReportDto,
    @CurrentUser() user: AuthenticatedUser,
    @ReqMeta() meta: RequestMeta,
  ) {
    return this.reports.resolve(id, dto, await this.library.viewer(user, meta));
  }
}
