import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { EVENT, type Paginated, type PartnerDesignation } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
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
import type { AvatarPresignDto, UpdateMeDto } from './presentation/dto/me.dto';
import { MeResponseDto } from './presentation/dto/me.dto';

const PLATFORM_ADMIN = 'Platform Admin';
const SUPER_ADMIN = 'Super Admin';

function buildFullName(first: string, middle: string | null | undefined, surname: string): string {
  return [first, middle, surname].filter(Boolean).join(' ');
}

@Injectable()
export class UsersService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
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

  private toDto(u: UserEntity): UserResponseDto {
    return {
      id: u.id,
      firstName: u.firstName,
      middleName: u.middleName ?? null,
      surname: u.surname,
      fullName: u.fullName,
      email: u.email,
      role: u.role.roleName,
      partnerDesignation: u.partnerDesignation ?? null,
      departmentId: u.department ? u.department.id : null,
      phoneNumber: u.phoneNumber ?? null,
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
    return this.toDto(user);
  }

  async list(query: UserListQueryDto): Promise<Paginated<UserResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.roleId) where.role = query.roleId;
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.$or = [{ fullName: { $ilike: `%${query.q}%` } }, { email: { $ilike: `%${query.q}%` } }];

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(UserEntity, where as FilterQuery<UserEntity>, {
      populate: ['role'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    return paginated(rows.map((u) => this.toDto(u)), total, page, pageSize);
  }

  async getOne(id: string): Promise<UserResponseDto> {
    const user = await this.em.findOne(UserEntity, { id }, { populate: ['role', 'department'] });
    if (!user) throw new NotFoundException('User not found');
    return this.toDto(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.em.findOneOrFail(UserEntity, { id }, { populate: ['role', 'department'] });

    const losingAdmin =
      user.role.roleName === PLATFORM_ADMIN &&
      ((dto.roleId != null && dto.roleId !== user.role.id) || dto.isActive === false);
    if (losingAdmin) await this.assertOtherActivePlatformAdminExists(id);

    if (dto.fullName != null) user.fullName = dto.fullName;
    if (dto.isActive != null) user.isActive = dto.isActive;
    if (dto.departmentId != null) user.department = this.em.getReference(DepartmentEntity, dto.departmentId);
    if (dto.roleId != null && dto.roleId !== user.role.id) {
      const role = await this.em.findOne(RoleEntity, { id: dto.roleId });
      if (!role) throw new NotFoundException('Role not found');
      user.role = role;
    }
    await this.em.flush();
    return this.toDto(user);
  }

  async deactivate(id: string): Promise<UserResponseDto> {
    return this.update(id, { isActive: false });
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
    return this.toDto(user);
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
