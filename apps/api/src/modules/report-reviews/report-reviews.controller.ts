import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { ReportReviewsService } from './report-reviews.service';
import {
  ClientPendingReportListDto,
  DownloadUrlResponseDto,
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
