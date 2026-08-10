import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { PartnerReportsService } from './partner-reports.service';
import {
  CreateInviteDto,
  InviteListResponseDto,
  InviteResultDto,
  MyReportingStatusDto,
  PartnerReportListResponseDto,
  PartnerReportResponseDto,
  ReporterDto,
  ReporterListResponseDto,
  ReportListQueryDto,
  RequestReportDto,
  ReviewReportDto,
  SaveReportDto,
  UpdateReporterDto,
} from './presentation/dto/partner-report.dto';

@ApiTags('partner-reports')
@ApiBearerAuth()
@Controller('partner-reports')
export class PartnerReportsController {
  constructor(private readonly reports: PartnerReportsService) {}

  // ---- static routes before :id ----

  @Get('dashboard')
  @RequirePermission('partner-report:view-all')
  dashboard(): Promise<Record<string, number>> {
    return this.reports.dashboard();
  }

  @Get('me/status')
  @RequirePermission('partner-report:view')
  myStatus(@CurrentUser() user: AuthenticatedUser): Promise<MyReportingStatusDto> {
    return this.reports.myReportingStatus(user);
  }

  @Get('export')
  @RequirePermission('partner-report:view')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportList(
    @Query() query: ReportListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.reports.exportListCsv(query, user);
    res.setHeader('Content-Disposition', 'attachment; filename="partner-reports.csv"');
    res.send(csv);
  }

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

  @Get('reporters')
  @RequirePermission('partner-report:invite')
  listReporters(): Promise<ReporterListResponseDto> {
    return this.reports.listReporters().then((data) => ({ data }));
  }

  @Patch('reporters/:userId')
  @RequirePermission('partner-report:invite')
  updateReporter(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateReporterDto,
  ): Promise<ReporterDto> {
    return this.reports.updateReporter(userId, dto);
  }

  @Post('reporters/:userId/request')
  @RequirePermission('partner-report:invite')
  requestReport(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: RequestReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReporterDto> {
    return this.reports.requestReport(userId, dto, user);
  }

  @Post('reporters/:userId/remind')
  @RequirePermission('partner-report:invite')
  remindReporter(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReporterDto> {
    return this.reports.remindReporter(userId, user);
  }

  @Delete('reporters/:userId')
  @HttpCode(204)
  @RequirePermission('partner-report:invite')
  async removeReporter(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    await this.reports.removeReporter(userId);
  }

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

  @Get(':id/export')
  @RequirePermission('partner-report:view')
  async exportOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.reports.exportReportPdf(id, user);
    const safe = id.slice(0, 8);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="partner-report-${safe}.pdf"`);
    res.send(pdf);
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
