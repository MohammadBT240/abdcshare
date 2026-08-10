import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  EVENT,
  hasPermission,
  type Paginated,
  type PartnerDesignation,
} from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import type { AuthenticatedUser } from '../../common/interfaces/authenticated-user';
import { TokenService } from '../auth/application/token.service';
import { OutboxService } from '../outbox/outbox.service';
import { UserEntity } from './infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { DepartmentEntity } from '../departments/infrastructure/persistence/department.entity';
import { ClientEntity } from '../clients/infrastructure/persistence/client.entity';
import { TitleEntity } from '../reference/infrastructure/persistence/titles.entity';
import { GenderEntity } from '../reference/infrastructure/persistence/genders.entity';
import { MaritalStatusEntity } from '../reference/infrastructure/persistence/marital-statuses.entity';
import type { CreateUserDto } from './presentation/dto/create-user.dto';
import type { UpdateUserDto } from './presentation/dto/update-user.dto';
import type { UserListQueryDto } from './presentation/dto/user-list-query.dto';
import { UserResponseDto } from './presentation/dto/user-response.dto';
import type { AvatarPresignDto, AvatarUploadDto, UpdateMeDto } from './presentation/dto/me.dto';
import { MeResponseDto } from './presentation/dto/me.dto';

const PLATFORM_ADMIN = 'Platform Admin';
const SUPER_ADMIN = 'Super Admin';
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function buildFullName(first: string, middle: string | null | undefined, surname: string): string {
  return [first, middle, surname].filter(Boolean).join(' ');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly tokens: TokenService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private async loadMe(userId: string): Promise<UserEntity> {
    const user = await this.em.findOne(UserEntity, { id: userId }, { populate: ['role'] });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async toMeDto(u: UserEntity): Promise<MeResponseDto> {
    return {
      id: u.id,
      titleId: u.title ? u.title.id : null,
      firstName: u.firstName,
      middleName: u.middleName ?? null,
      surname: u.surname,
      fullName: u.fullName,
      email: u.email,
      role: u.role.roleName,
      partnerDesignation: u.partnerDesignation ?? null,
      departmentId: u.department ? u.department.id : null,
      genderId: u.gender ? u.gender.id : null,
      maritalStatusId: u.maritalStatus ? u.maritalStatus.id : null,
      phoneNumber: u.phoneNumber ?? null,
      officialAddress: u.officialAddress ?? null,
      residentialAddress: u.residentialAddress ?? null,
      avatarUrl: u.avatarPath ? await this.storage.presignDownload(u.avatarPath) : null,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
    };
  }

  /** The authenticated user's own full profile. */
  async getMe(userId: string): Promise<MeResponseDto> {
    return this.toMeDto(await this.loadMe(userId));
  }

  /** Self-service edit of own profile (not role/department/email — those are admin-managed). */
  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeResponseDto> {
    const user = await this.loadMe(userId);
    if (dto.titleId != null) user.title = this.em.getReference(TitleEntity, dto.titleId);
    if (dto.genderId != null) user.gender = this.em.getReference(GenderEntity, dto.genderId);
    if (dto.maritalStatusId != null) {
      user.maritalStatus = this.em.getReference(MaritalStatusEntity, dto.maritalStatusId);
    }
    if (dto.firstName != null) user.firstName = dto.firstName;
    if (dto.middleName !== undefined) user.middleName = dto.middleName ?? null;
    if (dto.surname != null) user.surname = dto.surname;
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber ?? null;
    if (dto.officialAddress !== undefined) user.officialAddress = dto.officialAddress ?? null;
    if (dto.residentialAddress !== undefined) user.residentialAddress = dto.residentialAddress ?? null;
    user.fullName = buildFullName(user.firstName, user.middleName, user.surname);
    await this.em.flush();
    return this.toMeDto(user);
  }

  /**
   * Platform Admin (`user:manage`) may set any user's avatar.
   * Super Admin (`client:manage` only) may set avatars for Client-role contacts.
   */
  async assertCanManageAvatar(actor: AuthenticatedUser, targetUserId: string): Promise<void> {
    if (hasPermission(actor.role, 'user:manage', actor.partnerDesignation)) return;

    if (!hasPermission(actor.role, 'client:manage', actor.partnerDesignation)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    const target = await this.em.findOne(
      UserEntity,
      { id: targetUserId },
      { populate: ['role'] },
    );
    if (!target) throw new NotFoundException('User not found');
    if (target.role.roleName !== 'Client') {
      throw new ForbiddenException('Only Client contact avatars can be updated with client:manage');
    }
  }

  async avatarPresignUpload(userId: string, dto: AvatarPresignDto) {
    return this.storage.presignUpload({
      keyPrefix: `avatars/${userId}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });
  }

  async avatarConfirm(userId: string, storageKey: string): Promise<MeResponseDto> {
    const user = await this.loadMe(userId);
    user.avatarPath = storageKey;
    await this.em.flush();
    return this.toMeDto(user);
  }

  /** Upload avatar bytes via the API (preferred — works when R2 CORS blocks browser PUT). */
  async avatarUpload(userId: string, dto: AvatarUploadDto): Promise<MeResponseDto> {
    if (!AVATAR_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Use a JPEG, PNG, or WebP image');
    }
    const body = Buffer.from(dto.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!body.length) throw new BadRequestException('Image data is empty');
    if (body.length > MAX_AVATAR_BYTES) {
      throw new BadRequestException('Image must be 2 MB or smaller');
    }

    const { storageKey } = await this.storage.upload({
      keyPrefix: `avatars/${userId}`,
      fileName: dto.fileName,
      contentType: dto.contentType,
      body,
    });

    const user = await this.loadMe(userId);
    user.avatarPath = storageKey;
    await this.em.flush();
    return this.toMeDto(user);
  }

  private async toDto(u: UserEntity, opts?: { includeAvatar?: boolean }): Promise<UserResponseDto> {
    return {
      id: u.id,
      firstName: u.firstName,
      middleName: u.middleName ?? null,
      surname: u.surname,
      fullName: u.fullName,
      email: u.email,
      role: u.role.roleName,
      partnerDesignation: u.partnerDesignation ?? null,
      titleId: u.title ? u.title.id : null,
      genderId: u.gender ? u.gender.id : null,
      maritalStatusId: u.maritalStatus ? u.maritalStatus.id : null,
      departmentId: u.department ? u.department.id : null,
      clientId: u.client ? u.client.id : null,
      phoneNumber: u.phoneNumber ?? null,
      officialAddress: u.officialAddress ?? null,
      residentialAddress: u.residentialAddress ?? null,
      avatarUrl:
        opts?.includeAvatar && u.avatarPath
          ? await this.storage.presignDownload(u.avatarPath)
          : null,
      isActive: u.isActive,
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
    };
  }

  async create(dto: CreateUserDto): Promise<UserResponseDto> {
    const email = dto.email.toLowerCase();
    if (await this.em.findOne(UserEntity, { email })) {
      throw new ConflictException('A user with this email already exists');
    }
    const role = await this.em.findOne(RoleEntity, { id: dto.roleId });
    if (!role) throw new NotFoundException('Role not found');

    const tempPassword = dto.password ?? randomBytes(9).toString('base64url');
    const user = this.em.create(UserEntity, {
      role,
      department: dto.departmentId ? this.em.getReference(DepartmentEntity, dto.departmentId) : null,
      client: dto.clientId ? this.em.getReference(ClientEntity, dto.clientId) : null,
      title: dto.titleId ? this.em.getReference(TitleEntity, dto.titleId) : null,
      gender: dto.genderId ? this.em.getReference(GenderEntity, dto.genderId) : null,
      maritalStatus: dto.maritalStatusId ? this.em.getReference(MaritalStatusEntity, dto.maritalStatusId) : null,
      firstName: dto.firstName,
      middleName: dto.middleName ?? null,
      surname: dto.surname,
      fullName: buildFullName(dto.firstName, dto.middleName, dto.surname),
      phoneNumber: dto.phoneNumber ?? null,
      officialAddress: dto.officialAddress ?? null,
      residentialAddress: dto.residentialAddress ?? null,
      email,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    });
    // Outbox row flushes in the same unit of work → worker emails the credentials.
    this.outbox.enqueue(EVENT.UserCreated, { userId: user.id, email, tempPassword });
    await this.em.flush();
    return await this.toDto(user);
  }

  async list(query: UserListQueryDto): Promise<Paginated<UserResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.roleId) {
      where.role = query.roleId;
    } else {
      // Portal logins are managed under Clients — exclude from the firm users report.
      where.role = { roleName: { $nin: ['Client'] } };
    }
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.$or = [{ fullName: { $ilike: `%${query.q}%` } }, { email: { $ilike: `%${query.q}%` } }];

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(UserEntity, where as FilterQuery<UserEntity>, {
      populate: ['role', 'department', 'title', 'gender', 'maritalStatus', 'client'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    const data = await Promise.all(rows.map((u) => this.toDto(u, { includeAvatar: true })));
    return paginated(data, total, page, pageSize);
  }

  async getOne(id: string): Promise<UserResponseDto> {
    const user = await this.em.findOne(
      UserEntity,
      { id },
      { populate: ['role', 'department', 'title', 'gender', 'maritalStatus', 'client'] },
    );
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user, { includeAvatar: true });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.em.findOneOrFail(
      UserEntity,
      { id },
      { populate: ['role', 'department', 'title', 'gender', 'maritalStatus', 'client'] },
    );

    const losingAdmin =
      user.role.roleName === PLATFORM_ADMIN &&
      ((dto.roleId != null && dto.roleId !== user.role.id) || dto.isActive === false);
    if (losingAdmin) await this.assertOtherActivePlatformAdminExists(id);

    if (dto.email != null) {
      const email = dto.email.toLowerCase();
      const clash = await this.em.findOne(UserEntity, { email, id: { $ne: id } });
      if (clash) throw new ConflictException('A user with this email already exists');
      user.email = email;
    }

    if (dto.firstName != null) user.firstName = dto.firstName;
    if (dto.middleName !== undefined) user.middleName = dto.middleName ?? null;
    if (dto.surname != null) user.surname = dto.surname;
    if (dto.firstName != null || dto.middleName !== undefined || dto.surname != null) {
      user.fullName = buildFullName(user.firstName, user.middleName, user.surname);
    } else if (dto.fullName != null) {
      user.fullName = dto.fullName;
    }

    if (dto.titleId !== undefined) {
      user.title = dto.titleId == null ? null : this.em.getReference(TitleEntity, dto.titleId);
    }
    if (dto.genderId !== undefined) {
      user.gender = dto.genderId == null ? null : this.em.getReference(GenderEntity, dto.genderId);
    }
    if (dto.maritalStatusId !== undefined) {
      user.maritalStatus =
        dto.maritalStatusId == null ? null : this.em.getReference(MaritalStatusEntity, dto.maritalStatusId);
    }
    if (dto.departmentId !== undefined) {
      user.department =
        dto.departmentId == null ? null : this.em.getReference(DepartmentEntity, dto.departmentId);
    }
    if (dto.clientId !== undefined) {
      user.client = dto.clientId == null ? null : this.em.getReference(ClientEntity, dto.clientId);
    }
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber ?? null;
    if (dto.officialAddress !== undefined) user.officialAddress = dto.officialAddress ?? null;
    if (dto.residentialAddress !== undefined) user.residentialAddress = dto.residentialAddress ?? null;
    if (dto.isActive != null) user.isActive = dto.isActive;

    if (dto.roleId != null && dto.roleId !== user.role.id) {
      const role = await this.em.findOne(RoleEntity, { id: dto.roleId });
      if (!role) throw new NotFoundException('Role not found');
      user.role = role;
      if (role.roleName !== SUPER_ADMIN) user.partnerDesignation = null;
    }
    await this.em.flush();
    return this.toDto(user, { includeAvatar: true });
  }

  async deactivate(id: string): Promise<UserResponseDto> {
    return this.update(id, { isActive: false });
  }

  /**
   * Admin password reset (B-4): mint a new temporary password, force change on next
   * login, revoke sessions, and email credentials via the existing `user.created` worker path.
   */
  async resetPassword(id: string): Promise<UserResponseDto> {
    const user = await this.em.findOne(
      UserEntity,
      { id },
      { populate: ['role', 'department', 'title', 'gender', 'maritalStatus', 'client'] },
    );
    if (!user) throw new NotFoundException('User not found');
    if (!user.isActive) throw new BadRequestException('Cannot reset password for an inactive user');

    const tempPassword = randomBytes(9).toString('base64url');
    user.passwordHash = await bcrypt.hash(tempPassword, 12);
    user.mustChangePassword = true;
    this.outbox.enqueue(EVENT.UserCreated, {
      userId: user.id,
      email: user.email,
      tempPassword,
    });
    await this.em.flush();
    await this.tokens.revokeAllForUser(user.id);
    return this.toDto(user, { includeAvatar: true });
  }

  /** Assign/clear a Super Admin's partner designation. At most one PrincipalPartner. */
  async assignDesignation(id: string, designation: PartnerDesignation | null): Promise<UserResponseDto> {
    const user = await this.em.findOneOrFail(UserEntity, { id }, { populate: ['role'] });
    if (user.role.roleName !== SUPER_ADMIN) {
      throw new BadRequestException('Partner designation applies to Super Admins only');
    }
    if (designation === 'PrincipalPartner') {
      const existing = await this.em.count(UserEntity, {
        partnerDesignation: 'PrincipalPartner',
        id: { $ne: id },
      });
      if (existing > 0) throw new ConflictException('A Principal Partner already exists');
    }
    user.partnerDesignation = designation;
    await this.em.flush();
    return this.toDto(user, { includeAvatar: true });
  }

  private async assertOtherActivePlatformAdminExists(excludeUserId: string): Promise<void> {
    const others = await this.em.count(UserEntity, {
      role: { roleName: PLATFORM_ADMIN },
      isActive: true,
      id: { $ne: excludeUserId },
    });
    if (others === 0) {
      throw new ConflictException('Cannot remove the last active Platform Admin');
    }
  }
}
