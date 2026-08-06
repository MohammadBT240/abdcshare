import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { ReportReviewsService } from './report-reviews.service';
import {
  ClientPendingReportListDto,
  DownloadUrlResponseDto,
  FirmReportListDto,
  FirmReportListQueryDto,
  OverrideReportDto,
  PendingReportListQueryDto,
  ReportReviewStatusDto,
  RespondReportDto,
} from './presentation/dto/report-review.dto';

/** Firm side (Super Admin): send a final-report draft to the client, override a lock. */
@ApiTags('final-report-review (firm)')
@ApiBearerAuth()
@Controller('documents')
export class FinalReportReviewFirmController {
  constructor(private readonly reviews: ReportReviewsService) {}

  @Get(':id/final-report')
  @RequirePermission('report-review:manage')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    return this.reviews.statusForFirm(id, user);
  }

  @Post(':id/final-report/send')
  @RequirePermission('report-review:manage')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    return this.reviews.sendToClient(id, user);
  }

  @Post(':id/final-report/override')
  @RequirePermission('report-review:manage')
  override(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OverrideReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    return this.reviews.override(id, dto, user);
  }
}

/** Client side: view final reports awaiting review, download, approve / request changes. */
@ApiTags('final-report-review (client)')
@ApiBearerAuth()
@Controller('final-reports')
export class FinalReportReviewClientController {
  constructor(private readonly reviews: ReportReviewsService) {}

  @Get()
  @RequirePermission('report-review:respond')
  pending(
    @Query() query: PendingReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientPendingReportListDto> {
    return this.reviews.listPendingForClient(user, query);
  }

  @Get('firm')
  @RequirePermission('report-review:manage')
  firmList(
    @Query() query: FirmReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FirmReportListDto> {
    return this.reviews.listForFirm(user, query);
  }

  @Get(':id')
  @RequirePermission('report-review:respond')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    return this.reviews.getForClient(id, user);
  }

  @Get(':id/download')
  @RequirePermission('report-review:respond')
  download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DownloadUrlResponseDto> {
    return this.reviews.downloadForClient(id, user);
  }

  @Get(':id/files/:fileId/download')
  @RequirePermission('report-review:respond')
  downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DownloadUrlResponseDto> {
    return this.reviews.downloadFile(id, fileId, user);
  }

  @Get(':id/files/:fileId/preview')
  @RequirePermission('report-review:respond')
  previewFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('retryFailed') retryFailed: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.previewFile(id, fileId, user, {
      retryFailed: retryFailed === '1' || retryFailed === 'true',
    });
  }

  @Get(':id/files/:fileId/zip-entries')
  @RequirePermission('report-review:respond')
  zipEntries(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.zipEntries(id, fileId, user);
  }

  @Get(':id/files/:fileId/zip-entry')
  @RequirePermission('report-review:respond')
  zipEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query('path') entryPath: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reviews.zipEntryUrl(id, fileId, entryPath, user);
  }

  @Post(':id/respond')
  @RequirePermission('report-review:respond')
  respond(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RespondReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReportReviewStatusDto> {
    return this.reviews.respond(id, dto, user);
  }
}
