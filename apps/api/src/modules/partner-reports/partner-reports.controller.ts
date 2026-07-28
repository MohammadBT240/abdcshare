import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { PartnerReportsService } from './partner-reports.service';
import {
  CreateInviteDto,
  InviteListResponseDto,
  InviteResultDto,
  PartnerReportListResponseDto,
  PartnerReportResponseDto,
  ReportListQueryDto,
  ReviewReportDto,
  SaveReportDto,
} from './presentation/dto/partner-report.dto';

@ApiTags('partner-reports')
@ApiBearerAuth()
@Controller('partner-reports')
export class PartnerReportsController {
  constructor(private readonly reports: PartnerReportsService) {}

  // ---- static routes before :id ----

  /** Chairman dashboard headline counts. */
  @Get('dashboard')
  @RequirePermission('partner-report:view-all')
  dashboard(): Promise<Record<string, number>> {
    return this.reports.dashboard();
  }

  /**
   * Invite a guest (Principal Partner only). A new email provisions a Guest login;
   * an email that already exists is reminded to submit instead of re-provisioned.
   */
  @Post('invites')
  @RequirePermission('partner-report:invite')
  createInvite(
    @Body() dto: CreateInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteResultDto> {
    return this.reports.createInvite(dto, user);
  }

  @Get('invites')
  @RequirePermission('partner-report:invite')
  listInvites(
    @Query() query: ReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InviteListResponseDto> {
    return this.reports.listInvites(user, query);
  }

  // ---- reports ----

  @Post()
  @RequirePermission('partner-report:submit')
  create(
    @Body() dto: SaveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportResponseDto> {
    return this.reports.create(dto, user);
  }

  @Get()
  @RequirePermission('partner-report:view')
  list(
    @Query() query: ReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportListResponseDto> {
    return this.reports.list(query, user);
  }

  @Get(':id')
  @RequirePermission('partner-report:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportResponseDto> {
    return this.reports.getOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('partner-report:submit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportResponseDto> {
    return this.reports.update(id, dto, user);
  }

  @Post(':id/submit')
  @RequirePermission('partner-report:submit')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportResponseDto> {
    return this.reports.submit(id, user);
  }

  @Post(':id/review')
  @RequirePermission('partner-report:review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PartnerReportResponseDto> {
    return this.reports.review(id, dto, user);
  }
}
