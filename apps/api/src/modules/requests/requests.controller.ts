import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { RequestsService } from './requests.service';
import {
  AssignRequestDto,
  BulkUpdateRequestsDto,
  ConfirmRequestBriefDto,
  CreateRequestDto,
  PresignRequestBriefDto,
  RequestDetailResponseDto,
  RequestHistoryItemDto,
  RequestListQueryDto,
  RequestListResponseDto,
  SetStageDto,
  SetStatusDto,
  UpdateRequestDto,
} from './presentation/dto/request.dto';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @RequirePermission('request:create')
  create(
    @Body() dto: CreateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.create(dto, user);
  }

  @Get()
  @RequirePermission('request:view')
  list(
    @Query() query: RequestListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestListResponseDto> {
    return this.requests.list(query, user);
  }

  @Post('bulk')
  @RequirePermission('request:update')
  bulkUpdate(
    @Body() dto: BulkUpdateRequestsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ updated: number }> {
    return this.requests.bulkUpdate(dto, user);
  }

  @Get(':id/history')
  @RequirePermission('request:view')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestHistoryItemDto[]> {
    return this.requests.getHistory(id, user);
  }

  @Get(':id')
  @RequirePermission('request:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.getOne(id, user);
  }

  @Post(':id/brief/presign')
  @RequirePermission('request:update')
  presignBrief(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PresignRequestBriefDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.presignBrief(id, dto, user);
  }

  @Post(':id/brief/confirm')
  @RequirePermission('request:update')
  confirmBrief(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmRequestBriefDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.confirmBrief(id, dto, user);
  }

  @Post(':id/brief/download')
  @RequirePermission('request:view')
  downloadBrief(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.downloadBrief(id, user);
  }

  @Get(':id/brief/preview')
  @RequirePermission('request:view')
  previewBrief(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('retryFailed') retryFailed: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.requests.previewBrief(id, user, {
      retryFailed: retryFailed === '1' || retryFailed === 'true',
    });
  }

  @Delete(':id/brief')
  @RequirePermission('request:update')
  removeBrief(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.removeBrief(id, user);
  }

  /** Edit / delete / stage / status — Super Admin (request:update + catalogue:view). */
  @Patch(':id')
  @RequirePermission('request:update', 'catalogue:view')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.update(id, dto, user);
  }

  @Delete(':id')
  @RequirePermission('request:update', 'catalogue:view')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    return this.requests.remove(id, user);
  }

  /** Stage is inferred from activity — manual changes are rejected. */
  @Post(':id/stage')
  @RequirePermission('request:update', 'catalogue:view')
  setStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.setStage(id, dto, user);
  }

  @Post(':id/status')
  @RequirePermission('request:update', 'catalogue:view')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.setStatus(id, dto, user);
  }

  /** Assignees — Super Admin (request:assign + catalogue:view). */
  @Post(':id/assignees')
  @RequirePermission('request:assign', 'catalogue:view')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.assign(id, dto, user);
  }

  @Delete(':id/assignees/:userId')
  @RequirePermission('request:assign', 'catalogue:view')
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.unassign(id, memberUserId, user);
  }
}
