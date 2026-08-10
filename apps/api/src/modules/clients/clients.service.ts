import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { EVENT, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { OutboxService } from '../outbox/outbox.service';
import { UsersService } from '../users/users.service';
import { ClientEntity } from './infrastructure/persistence/client.entity';
import { ClientTypeEntity } from '../reference/infrastructure/persistence/client-types.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { TitleEntity } from '../reference/infrastructure/persistence/titles.entity';
import type { CreateClientDto } from './presentation/dto/create-client.dto';
import type { UpdateClientDto } from './presentation/dto/update-client.dto';
import type { ClientListQueryDto } from './presentation/dto/client-list-query.dto';
import type {
  CreateClientContactDto,
  UpdateClientContactDto,
} from './presentation/dto/client-contact.dto';
import { ClientContactResponseDto } from './presentation/dto/client-contact.dto';
import { ClientResponseDto } from './presentation/dto/client-response.dto';
import { EngagementClientContactEntity } from '../engagements/infrastructure/persistence/engagement-client-contact.entity';

const CLIENT_ROLE = 'Client';

function buildFullName(first: string, middle: string | null | undefined, surname: string): string {
  return [first, middle, surname].filter(Boolean).join(' ');
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
    private readonly users: UsersService,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

  private async toDto(c: ClientEntity): Promise<ClientResponseDto> {
    const contact = c.primaryContact;
    return {
      id: c.id,
      name: c.name,
      clientType: c.clientType ? c.clientType.name : null,
      clientTypeId: c.clientType ? c.clientType.id : null,
      companyName: c.companyName ?? null,
      companyRegisteredAddress: c.companyRegisteredAddress ?? null,
      incorporationDate: c.incorporationDate ?? null,
      incorporationNo: c.incorporationNo ?? null,
      officialAddress: c.officialAddress ?? null,
      residentialAddress: c.residentialAddress ?? null,
      email: c.email ?? null,
      phoneNumber: c.phoneNumber ?? null,
      primaryContactName: contact ? contact.fullName : null,
      primaryContactFirstName: contact ? contact.firstName : null,
      primaryContactSurname: contact ? contact.surname : null,
      primaryContactEmail: contact ? contact.email : null,
      primaryContactPhone: contact ? (contact.phoneNumber ?? null) : null,
      primaryContactId: contact ? contact.id : null,
      primaryContactAvatarUrl:
        contact?.avatarPath ? await this.storage.presignDownload(contact.avatarPath) : null,
      isActive: c.isActive,
      createdAt: c.createdAt,
    };
  }

  /**
   * Provision a client organisation together with its primary contact login.
   * The contact becomes a `Client`-role user linked to the client; a temporary
   * password is generated and the `user.created` outbox event emails the
   * credentials — all in one unit of work.
   */
  async create(dto: CreateClientDto): Promise<ClientResponseDto> {
    if (await this.em.findOne(ClientEntity, { name: dto.name })) {
      throw new ConflictException('A client with this name already exists');
    }
    const contactEmail = dto.contact.email.toLowerCase();
    if (await this.em.findOne(UserEntity, { email: contactEmail })) {
      throw new ConflictException('A user with the contact email already exists');
    }
    const clientRole = await this.em.findOne(RoleEntity, { roleName: CLIENT_ROLE });
    if (!clientRole) throw new NotFoundException('Client role is not seeded');

    const client = this.em.create(ClientEntity, {
      name: dto.name,
      clientType: dto.clientTypeId ? this.em.getReference(ClientTypeEntity, dto.clientTypeId) : null,
      companyName: dto.companyName ?? null,
      companyRegisteredAddress: dto.companyRegisteredAddress ?? null,
      incorporationDate: dto.incorporationDate ?? null,
      incorporationNo: dto.incorporationNo ?? null,
      officialAddress: dto.officialAddress ?? null,
      residentialAddress: dto.residentialAddress ?? null,
      email: dto.email ?? null,
      phoneNumber: dto.phoneNumber ?? null,
      isActive: true,
    });

    const tempPassword = randomBytes(9).toString('base64url');
    const contact = this.em.create(UserEntity, {
      role: clientRole,
      client,
      title: dto.contact.titleId ? this.em.getReference(TitleEntity, dto.contact.titleId) : null,
      firstName: dto.contact.firstName,
      middleName: dto.contact.middleName ?? null,
      surname: dto.contact.surname,
      fullName: buildFullName(dto.contact.firstName, dto.contact.middleName, dto.contact.surname),
      email: contactEmail,
      phoneNumber: dto.contact.phoneNumber ?? null,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    });
    client.primaryContact = contact;

    this.outbox.enqueue(EVENT.UserCreated, { userId: contact.id, email: contactEmail, tempPassword });
    await this.em.persistAndFlush([client, contact]);
    return this.toDto(client);
  }

  async list(query: ClientListQueryDto): Promise<Paginated<ClientResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.clientTypeId) where.clientType = query.clientTypeId;
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.name = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(ClientEntity, where as FilterQuery<ClientEntity>, {
      populate: ['clientType', 'primaryContact'],
      orderBy: { createdAt: 'desc', id: 'asc' },
      limit,
      offset,
    });
    const data = await Promise.all(rows.map((c) => this.toDto(c)));
    return paginated(data, total, page, pageSize);
  }

  async getOne(id: string): Promise<ClientResponseDto> {
    const client = await this.em.findOne(ClientEntity, { id }, { populate: ['clientType', 'primaryContact'] });
    if (!client) throw new NotFoundException('Client not found');
    return this.toDto(client);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const client = await this.em.findOneOrFail(
      ClientEntity,
      { id },
      { populate: ['clientType', 'primaryContact'] },
    );

    if (dto.name != null) client.name = dto.name;
    if (dto.clientTypeId !== undefined) {
      client.clientType =
        dto.clientTypeId == null ? null : this.em.getReference(ClientTypeEntity, dto.clientTypeId);
    }
    if (dto.companyName !== undefined) client.companyName = dto.companyName ?? null;
    if (dto.companyRegisteredAddress !== undefined) {
      client.companyRegisteredAddress = dto.companyRegisteredAddress ?? null;
    }
    if (dto.incorporationDate !== undefined) client.incorporationDate = dto.incorporationDate ?? null;
    if (dto.incorporationNo !== undefined) client.incorporationNo = dto.incorporationNo ?? null;
    if (dto.officialAddress !== undefined) client.officialAddress = dto.officialAddress ?? null;
    if (dto.residentialAddress !== undefined) {
      client.residentialAddress = dto.residentialAddress ?? null;
    }
    if (dto.email !== undefined) client.email = dto.email ?? null;
    if (dto.phoneNumber !== undefined) client.phoneNumber = dto.phoneNumber ?? null;
    if (dto.isActive != null) client.isActive = dto.isActive;

    if (dto.contact) {
      const contact = client.primaryContact;
      if (!contact) throw new BadRequestException('Client has no primary contact to update');

      if (dto.contact.email != null) {
        const email = dto.contact.email.toLowerCase();
        const clash = await this.em.findOne(UserEntity, { email, id: { $ne: contact.id } });
        if (clash) throw new ConflictException('A user with the contact email already exists');
        contact.email = email;
      }
      if (dto.contact.firstName != null) contact.firstName = dto.contact.firstName;
      if (dto.contact.middleName !== undefined) contact.middleName = dto.contact.middleName ?? null;
      if (dto.contact.surname != null) contact.surname = dto.contact.surname;
      if (dto.contact.phoneNumber !== undefined) {
        contact.phoneNumber = dto.contact.phoneNumber ?? null;
      }
      if (dto.contact.titleId !== undefined) {
        contact.title =
          dto.contact.titleId == null
            ? null
            : this.em.getReference(TitleEntity, dto.contact.titleId);
      }
      contact.fullName = buildFullName(contact.firstName, contact.middleName, contact.surname);

      // Keep individual client display name in sync with the person.
      const typeName = client.clientType?.name?.toLowerCase();
      if (typeName === 'individual' && dto.name == null) {
        client.name = contact.fullName;
      }
    }

    await this.em.flush();
    return this.toDto(client);
  }

  async deactivate(id: string): Promise<ClientResponseDto> {
    return this.update(id, { isActive: false });
  }

  /** Reset primary contact login: new temp password emailed; forces change on next login. */
  async resetContactPassword(id: string): Promise<ClientResponseDto> {
    const client = await this.em.findOne(
      ClientEntity,
      { id },
      { populate: ['clientType', 'primaryContact'] },
    );
    if (!client) throw new NotFoundException('Client not found');
    const contact = client.primaryContact;
    if (!contact) throw new BadRequestException('Client has no primary contact login');
    await this.users.resetPassword(contact.id);
    return this.toDto(client);
  }

  // ---- Multi-contact management -------------------------------------------

  private async toContactDto(
    user: UserEntity,
    primaryId: string | null | undefined,
  ): Promise<ClientContactResponseDto> {
    return {
      id: user.id,
      firstName: user.firstName,
      middleName: user.middleName ?? null,
      surname: user.surname,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber ?? null,
      titleId: user.title ? user.title.id : null,
      isPrimary: Boolean(primaryId && user.id === primaryId),
      isActive: user.isActive,
      avatarUrl: user.avatarPath ? await this.storage.presignDownload(user.avatarPath) : null,
      createdAt: user.createdAt,
    };
  }

  private async loadClientOrFail(id: string): Promise<ClientEntity> {
    const client = await this.em.findOne(
      ClientEntity,
      { id },
      { populate: ['clientType', 'primaryContact'] },
    );
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  private async loadContactOrFail(clientId: string, userId: string): Promise<UserEntity> {
    const user = await this.em.findOne(
      UserEntity,
      { id: userId, client: clientId, role: { roleName: CLIENT_ROLE } },
      { populate: ['title', 'role', 'client'] },
    );
    if (!user) throw new NotFoundException('Contact not found for this client');
    return user;
  }

  async listContacts(clientId: string): Promise<ClientContactResponseDto[]> {
    const client = await this.loadClientOrFail(clientId);
    const rows = await this.em.find(
      UserEntity,
      { client: clientId, role: { roleName: CLIENT_ROLE } },
      { populate: ['title'], orderBy: { fullName: 'asc', id: 'asc' } },
    );
    const primaryId = client.primaryContact?.id ?? null;
    return Promise.all(rows.map((u) => this.toContactDto(u, primaryId)));
  }

  async addContact(
    clientId: string,
    dto: CreateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    const client = await this.loadClientOrFail(clientId);
    const email = dto.email.toLowerCase();
    if (await this.em.findOne(UserEntity, { email })) {
      throw new ConflictException('A user with the contact email already exists');
    }
    const clientRole = await this.em.findOne(RoleEntity, { roleName: CLIENT_ROLE });
    if (!clientRole) throw new NotFoundException('Client role is not seeded');

    const tempPassword = randomBytes(9).toString('base64url');
    const contact = this.em.create(UserEntity, {
      role: clientRole,
      client,
      title: dto.titleId ? this.em.getReference(TitleEntity, dto.titleId) : null,
      firstName: dto.firstName,
      middleName: dto.middleName ?? null,
      surname: dto.surname,
      fullName: buildFullName(dto.firstName, dto.middleName, dto.surname),
      email,
      phoneNumber: dto.phoneNumber ?? null,
      passwordHash: await bcrypt.hash(tempPassword, 12),
      mustChangePassword: true,
      isActive: true,
    });
    this.outbox.enqueue(EVENT.UserCreated, { userId: contact.id, email, tempPassword });
    await this.em.persistAndFlush(contact);
    return this.toContactDto(contact, client.primaryContact?.id ?? null);
  }

  async updateContact(
    clientId: string,
    userId: string,
    dto: UpdateClientContactDto,
  ): Promise<ClientContactResponseDto> {
    const client = await this.loadClientOrFail(clientId);
    const contact = await this.loadContactOrFail(clientId, userId);

    if (dto.email != null) {
      const email = dto.email.toLowerCase();
      const clash = await this.em.findOne(UserEntity, { email, id: { $ne: contact.id } });
      if (clash) throw new ConflictException('A user with the contact email already exists');
      contact.email = email;
    }
    if (dto.firstName != null) contact.firstName = dto.firstName;
    if (dto.middleName !== undefined) contact.middleName = dto.middleName ?? null;
    if (dto.surname != null) contact.surname = dto.surname;
    if (dto.phoneNumber !== undefined) contact.phoneNumber = dto.phoneNumber ?? null;
    if (dto.titleId !== undefined) {
      contact.title =
        dto.titleId == null ? null : this.em.getReference(TitleEntity, dto.titleId);
    }
    if (dto.isActive != null) {
      if (!dto.isActive) {
        await this.assertContactNotAssigned(userId);
        if (client.primaryContact?.id === contact.id) {
          throw new BadRequestException(
            'Cannot deactivate the primary contact. Set another primary first.',
          );
        }
      }
      contact.isActive = dto.isActive;
    }
    contact.fullName = buildFullName(contact.firstName, contact.middleName, contact.surname);

    const typeName = client.clientType?.name?.toLowerCase();
    if (
      typeName === 'individual' &&
      client.primaryContact?.id === contact.id
    ) {
      client.name = contact.fullName;
    }

    await this.em.flush();
    return this.toContactDto(contact, client.primaryContact?.id ?? null);
  }

  async setPrimaryContact(clientId: string, userId: string): Promise<ClientContactResponseDto> {
    const client = await this.loadClientOrFail(clientId);
    const contact = await this.loadContactOrFail(clientId, userId);
    if (!contact.isActive) {
      throw new BadRequestException('Cannot set an inactive contact as primary');
    }
    client.primaryContact = contact;
    await this.em.flush();
    return this.toContactDto(contact, contact.id);
  }

  async resetContactUserPassword(
    clientId: string,
    userId: string,
  ): Promise<ClientContactResponseDto> {
    const client = await this.loadClientOrFail(clientId);
    const contact = await this.loadContactOrFail(clientId, userId);
    await this.users.resetPassword(contact.id);
    return this.toContactDto(contact, client.primaryContact?.id ?? null);
  }

  async deactivateContact(clientId: string, userId: string): Promise<ClientContactResponseDto> {
    return this.updateContact(clientId, userId, { isActive: false });
  }

  private async assertContactNotAssigned(userId: string): Promise<void> {
    const assigned = await this.em.count(EngagementClientContactEntity, { user: userId });
    if (assigned > 0) {
      throw new BadRequestException(
        'Contact is assigned to one or more engagements. Remove them from those engagements first.',
      );
    }
  }
}
