import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { EVENT, type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { OutboxService } from '../outbox/outbox.service';
import { ClientEntity } from './infrastructure/persistence/client.entity';
import { ClientTypeEntity } from '../reference/infrastructure/persistence/client-types.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import { RoleEntity } from '../roles/infrastructure/persistence/role.entity';
import { TitleEntity } from '../reference/infrastructure/persistence/titles.entity';
import type { CreateClientDto } from './presentation/dto/create-client.dto';
import type { UpdateClientDto } from './presentation/dto/update-client.dto';
import type { ClientListQueryDto } from './presentation/dto/client-list-query.dto';
import { ClientResponseDto } from './presentation/dto/client-response.dto';

const CLIENT_ROLE = 'Client';

function buildFullName(first: string, middle: string | null | undefined, surname: string): string {
  return [first, middle, surname].filter(Boolean).join(' ');
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxService,
  ) {}

  private toDto(c: ClientEntity): ClientResponseDto {
    const contact = c.primaryContact;
    return {
      id: c.id,
      name: c.name,
      clientType: c.clientType ? c.clientType.name : null,
      companyName: c.companyName ?? null,
      incorporationNo: c.incorporationNo ?? null,
      email: c.email ?? null,
      phoneNumber: c.phoneNumber ?? null,
      primaryContactName: contact ? contact.fullName : null,
      primaryContactEmail: contact ? contact.email : null,
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
    return paginated(rows.map((c) => this.toDto(c)), total, page, pageSize);
  }

  async getOne(id: string): Promise<ClientResponseDto> {
    const client = await this.em.findOne(ClientEntity, { id }, { populate: ['clientType', 'primaryContact'] });
    if (!client) throw new NotFoundException('Client not found');
    return this.toDto(client);
  }

  async update(id: string, dto: UpdateClientDto): Promise<ClientResponseDto> {
    const client = await this.em.findOneOrFail(ClientEntity, { id }, { populate: ['clientType', 'primaryContact'] });
    if (dto.name != null) client.name = dto.name;
    if (dto.clientTypeId != null) client.clientType = this.em.getReference(ClientTypeEntity, dto.clientTypeId);
    if (dto.companyName != null) client.companyName = dto.companyName;
    if (dto.companyRegisteredAddress != null) client.companyRegisteredAddress = dto.companyRegisteredAddress;
    if (dto.incorporationDate != null) client.incorporationDate = dto.incorporationDate;
    if (dto.incorporationNo != null) client.incorporationNo = dto.incorporationNo;
    if (dto.officialAddress != null) client.officialAddress = dto.officialAddress;
    if (dto.residentialAddress != null) client.residentialAddress = dto.residentialAddress;
    if (dto.email != null) client.email = dto.email;
    if (dto.phoneNumber != null) client.phoneNumber = dto.phoneNumber;
    if (dto.isActive != null) client.isActive = dto.isActive;
    await this.em.flush();
    return this.toDto(client);
  }

  async deactivate(id: string): Promise<ClientResponseDto> {
    return this.update(id, { isActive: false });
  }
}
