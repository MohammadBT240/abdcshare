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
  AddClientContactDto,
  AddRequestClassDto,
  AddTeamMemberDto,
  CreateEngagementDto,
  CloneEngagementDto,
  EngagementDetailResponseDto,
  EngagementFilterOptionsDto,
  EngagementHistoryItemDto,
  EngagementListQueryDto,
  EngagementListResponseDto,
  EngagementWorkspaceResponseDto,
  CreateSignOffDto,
  RevokeSignOffDto,
  SignOffResponseDto,
  TransitionEngagementDto,
  UpdateClientContactAssignmentDto,
  UpdateEngagementDto,
} from './presentation/dto/engagement.dto';

@ApiTags('engagements')
@ApiBearerAuth()
@Controller('engagements')
export class EngagementsController {
  constructor(private readonly engagements: EngagementsService) {}

  /** Distinct clients/departments for list filters (scoped; no client:view required). */
  @Get('filter-options')
  @RequirePermission('engagement:view')
  filterOptions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementFilterOptionsDto> {
    return this.engagements.filterOptions(user);
  }

  @Get(':id/sign-offs')
  @RequirePermission('engagement:view')
  listSignOffs(@Param('id', ParseUUIDPipe) id: string): Promise<SignOffResponseDto[]> {
    return this.engagements.listSignOffs(id);
  }

  /**
   * Authz: engagement:view at the gate; service requires review:signoff OR Lead.
   */
  @Post(':id/sign-offs')
  @RequirePermission('engagement:view')
  signOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSignOffDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SignOffResponseDto> {
    return this.engagements.signOff(id, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires review:signoff OR Lead. */
  @Post(':id/sign-offs/:signOffId/revoke')
  @RequirePermission('engagement:view')
  revokeSignOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('signOffId', ParseUUIDPipe) signOffId: string,
    @Body() dto: RevokeSignOffDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SignOffResponseDto> {
    return this.engagements.revokeSignOff(id, signOffId, dto, user);
  }

  @Get(':id/workspace')
  @RequirePermission('engagement:view')
  getWorkspace(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementWorkspaceResponseDto> {
    return this.engagements.getWorkspace(id, user);
  }

  @Get(':id/history')
  @RequirePermission('engagement:view')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementHistoryItemDto[]> {
    return this.engagements.getHistory(id, user);
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

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Patch(':id')
  @RequirePermission('engagement:view')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.update(id, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires creating Super Admin. */
  @Post(':id/transition')
  @RequirePermission('engagement:view')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionEngagementDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.transition(id, dto, user);
  }

  @Post(':id/clone')
  @RequirePermission('engagement:create')
  clone(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloneEngagementDto,
    @CurrentUser('userId') userId: string,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.clone(id, dto, userId);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Post(':id/client-contacts')
  @RequirePermission('engagement:view')
  addClientContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddClientContactDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.addClientContact(id, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Patch(':id/client-contacts/:userId')
  @RequirePermission('engagement:view')
  updateClientContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateClientContactAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.updateClientContact(id, userId, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Delete(':id/client-contacts/:userId')
  @RequirePermission('engagement:view')
  removeClientContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.removeClientContact(id, userId, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Post(':id/team')
  @RequirePermission('engagement:view')
  addTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTeamMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.addTeamMember(id, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Post(':id/team/:userId/elevate')
  @RequirePermission('engagement:view')
  elevateTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.elevateTeamMember(id, userId, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Delete(':id/team/:userId')
  @RequirePermission('engagement:view')
  removeTeamMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.removeTeamMember(id, userId, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Post(':id/request-classes')
  @RequirePermission('engagement:view')
  addRequestClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddRequestClassDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.addRequestClass(id, dto, user);
  }

  /** Authz: engagement:view at the gate; service requires engagement:update OR Lead. */
  @Delete(':id/request-classes/:requestClassId')
  @RequirePermission('engagement:view')
  removeRequestClass(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('requestClassId', ParseIntPipe) requestClassId: number,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EngagementDetailResponseDto> {
    return this.engagements.removeRequestClass(id, requestClassId, user);
  }
}
