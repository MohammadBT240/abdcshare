import { Body, Controller, Get, Header, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  RequireAnyPermission,
  RequirePermission,
} from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { UsersService } from './users.service';
import { BulkUsersService } from './bulk-users.service';
import { CreateUserDto } from './presentation/dto/create-user.dto';
import { UpdateUserDto } from './presentation/dto/update-user.dto';
import { AssignDesignationDto } from './presentation/dto/assign-designation.dto';
import { BulkCsvDto } from './presentation/dto/bulk-csv.dto';
import { UserListQueryDto } from './presentation/dto/user-list-query.dto';
import { UserListResponseDto, UserResponseDto } from './presentation/dto/user-response.dto';
import {
  AvatarConfirmDto,
  AvatarPresignDto,
  AvatarUploadDto,
  MeResponseDto,
  UpdateMeDto,
} from './presentation/dto/me.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly bulk: BulkUsersService,
  ) {}

  @Post()
  @RequirePermission('user:manage')
  create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.create(dto);
  }

  @Get()
  @RequirePermission('user:view')
  list(@Query() query: UserListQueryDto): Promise<UserListResponseDto> {
    return this.users.list(query);
  }

  // ---- static routes BEFORE :id so they don't get captured as an id ----

  /** Own profile — any authenticated user (no permission required). */
  @Get('me')
  getMe(@CurrentUser('userId') userId: string): Promise<MeResponseDto> {
    return this.users.getMe(userId);
  }

  @Patch('me')
  updateMe(@CurrentUser('userId') userId: string, @Body() dto: UpdateMeDto): Promise<MeResponseDto> {
    return this.users.updateMe(userId, dto);
  }

  @Post('me/avatar/presign')
  avatarPresign(@CurrentUser('userId') userId: string, @Body() dto: AvatarPresignDto) {
    return this.users.avatarPresignUpload(userId, dto);
  }

  @Post('me/avatar')
  avatarUploadMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: AvatarUploadDto,
  ): Promise<MeResponseDto> {
    return this.users.avatarUpload(userId, dto);
  }

  /** @deprecated Prefer POST me/avatar with file bytes — kept for older clients. */
  @Post('me/avatar/confirm')
  avatarConfirm(
    @CurrentUser('userId') userId: string,
    @Body() dto: AvatarConfirmDto,
  ): Promise<MeResponseDto> {
    return this.users.avatarConfirm(userId, dto.storageKey);
  }

  @Get('export')
  @RequirePermission('user:view')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="users.csv"')
  exportCsv(@Query() query: UserListQueryDto): Promise<string> {
    return this.bulk.exportCsv({ roleId: query.roleId, isActive: query.isActive === 'true' ? true : query.isActive === 'false' ? false : undefined });
  }

  @Get('bulk/template')
  @RequirePermission('bulk-import:run')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="users-template.csv"')
  template(): string {
    return this.bulk.template();
  }

  @Post('bulk/preview')
  @RequirePermission('bulk-import:run')
  preview(@Body() dto: BulkCsvDto, @CurrentUser('userId') actorId: string) {
    return this.bulk.preview(dto.csv, actorId);
  }

  @Post('bulk/import')
  @RequirePermission('bulk-import:run')
  import(@Body() dto: BulkCsvDto, @CurrentUser('userId') actorId: string) {
    return this.bulk.import(dto.csv, actorId);
  }

  @Get(':id')
  @RequirePermission('user:view')
  getOne(@Param('id') id: string): Promise<UserResponseDto> {
    return this.users.getOne(id);
  }

  @Patch(':id')
  @RequirePermission('user:manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto): Promise<UserResponseDto> {
    return this.users.update(id, dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('user:manage')
  deactivate(@Param('id') id: string): Promise<UserResponseDto> {
    return this.users.deactivate(id);
  }

  /** Mint a new temp password, force change-on-login, and email credentials. */
  @Post(':id/reset-password')
  @RequirePermission('user:manage')
  resetPassword(@Param('id') id: string): Promise<UserResponseDto> {
    return this.users.resetPassword(id);
  }

  @Patch(':id/designation')
  @RequirePermission('user:manage')
  assignDesignation(
    @Param('id') id: string,
    @Body() dto: AssignDesignationDto,
  ): Promise<UserResponseDto> {
    return this.users.assignDesignation(id, dto.designation ?? null);
  }

  /** SA (client:manage) may set Client-role avatars; Platform Admin uses user:manage. */
  @Post(':id/avatar/presign')
  @RequireAnyPermission('user:manage', 'client:manage')
  async avatarPresignForUser(
    @Param('id') id: string,
    @Body() dto: AvatarPresignDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    await this.users.assertCanManageAvatar(actor, id);
    return this.users.avatarPresignUpload(id, dto);
  }

  @Post(':id/avatar')
  @RequireAnyPermission('user:manage', 'client:manage')
  async avatarUploadForUser(
    @Param('id') id: string,
    @Body() dto: AvatarUploadDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MeResponseDto> {
    await this.users.assertCanManageAvatar(actor, id);
    return this.users.avatarUpload(id, dto);
  }

  /** @deprecated Prefer POST :id/avatar with file bytes — kept for older clients. */
  @Post(':id/avatar/confirm')
  @RequireAnyPermission('user:manage', 'client:manage')
  async avatarConfirmForUser(
    @Param('id') id: string,
    @Body() dto: AvatarConfirmDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MeResponseDto> {
    await this.users.assertCanManageAvatar(actor, id);
    return this.users.avatarConfirm(id, dto.storageKey);
  }
}
