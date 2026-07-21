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
  CreateRequestDto,
  RequestDetailResponseDto,
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

  @Get(':id')
  @RequirePermission('request:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.getOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('request:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.update(id, dto, user);
  }

  @Post(':id/stage')
  @RequirePermission('request:update')
  setStage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.setStage(id, dto, user);
  }

  @Post(':id/status')
  @RequirePermission('request:update')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.setStatus(id, dto, user);
  }

  @Post(':id/assignees')
  @RequirePermission('request:assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.assign(id, dto, user);
  }

  @Delete(':id/assignees/:userId')
  @RequirePermission('request:assign')
  unassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) memberUserId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RequestDetailResponseDto> {
    return this.requests.unassign(id, memberUserId, user);
  }
}
