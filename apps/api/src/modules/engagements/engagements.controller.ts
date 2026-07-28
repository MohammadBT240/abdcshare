import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { EngagementsService } from './engagements.service';
import {
  AddRequestClassDto,
  AddTeamMemberDto,
  CreateEngagementDto,
  EngagementDetailResponseDto,
  EngagementListQueryDto,
  EngagementListResponseDto,
  CreateSignOffDto,
  RevokeSignOffDto,
  SignOffResponseDto,
  TransitionEngagementDto,
  UpdateEngagementDto,
} from './presentation/dto/engagement.dto';

@ApiTags('engagements')
@ApiBearerAuth()
@Controller('engagements')
export class EngagementsController {
  constructor(private readonly engagements: EngagementsService) {}

  @Get(':id/sign-offs')
  @RequirePermission('engagement:view')
  listSignOffs(@Param('id', ParseUUIDPipe) id: string): Promise<SignOffResponseDto[]> {
    return this.engagements.listSignOffs(id);
  }

  @Post(':id/sign-offs')
  @RequirePermission('review:signoff')
  signOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSignOffDto,
    @CurrentUser('userId') userId: string,
  ): Promise<SignOffResponseDto> {
    return this.engagements.signOff(id, dto, userId);
  }

  @Post(':id/sign-offs/:signOffId/revoke')
  @RequirePermission('review:signoff')
  revokeSignOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('signOffId', ParseUUIDPipe) signOffId: string,
    @Body() dto: RevokeSignOffDto,
    @CurrentUser('userId') userId: string,
  ): Promise<SignOffResponseDto> {
    return this.engagements.revokeSignOff(id, signOffId, dto, userId);
  }

  @Post()
  @RequirePermission('engagement:create')
  create(
    @Body() dto: CreateEngagementDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.create(dto, userId);
  }

  @Get()
  @RequirePermission('engagement:view')
  list(
    @Query() query: EngagementListQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementListResponseDto> {
    return this.engagements.list(query, user);
  }

  @Get(':id')
  @RequirePermission('engagement:view')
  getOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.getOne(id, user);
  }

  @Patch(':id')
  @RequirePermission('engagement:update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEngagementDto,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.update(id, dto);
  }

  @Post(':id/transition')
  @RequirePermission('engagement:transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionEngagementDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.transition(id, dto, userId);
  }

  @Post(':id/team')
  @RequirePermission('engagement:update')
  addTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.addTeamMember(id, dto, userId);
  }

  @Delete(':id/team/:userId')
  @RequirePermission('engagement:update')
  removeTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.removeTeamMember(id, userId);
  }

  @Post(':id/request-classes')
  @RequirePermission('engagement:update')
  addRequestClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRequestClassDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.addRequestClass(id, dto, userId);
  }

  @Delete(':id/request-classes/:requestClassId')
  @RequirePermission('engagement:update')
  removeRequestClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestClassId', ParseIntPipe) requestClassId: number,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.removeRequestClass(id, requestClassId);
  }
}
