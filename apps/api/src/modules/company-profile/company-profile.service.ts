import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { CompanyProfileEntity } from './infrastructure/persistence/company-profile.entity';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';
import type { UpdateCompanyProfileDto } from './presentation/dto/company-profile.dto';
import { CompanyProfileResponseDto } from './presentation/dto/company-profile.dto';

/** The firm's own profile — a single row (document library / letterhead source). */
@Injectable()
export class CompanyProfileService {
  constructor(private readonly em: EntityManager) {}

  private toDto(p: CompanyProfileEntity): CompanyProfileResponseDto {
    return {
      id: p.id,
      name: p.name ?? null,
      logoPath: p.logoPath ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      address: p.address ?? null,
      updatedById: p.updatedBy ? p.updatedBy.id : null,
      updatedAt: p.updatedAt,
    };
  }

  /** Fetch the singleton, creating an empty one on first access. */
  private async ensure(): Promise<CompanyProfileEntity> {
    const existing = await this.em.findOne(CompanyProfileEntity, {}, { populate: ['updatedBy'] });
    if (existing) return existing;
    const created = this.em.create(CompanyProfileEntity, { name: '', updatedAt: new Date() });
    await this.em.persistAndFlush(created);
    return created;
  }

  async get(): Promise<CompanyProfileResponseDto> {
    return this.toDto(await this.ensure());
  }

  async update(dto: UpdateCompanyProfileDto, userId: string): Promise<CompanyProfileResponseDto> {
    const profile = await this.ensure();
    if (dto.name != null) profile.name = dto.name;
    if (dto.logoPath !== undefined) profile.logoPath = dto.logoPath ?? null;
    if (dto.email !== undefined) profile.email = dto.email ?? null;
    if (dto.phone !== undefined) profile.phone = dto.phone ?? null;
    if (dto.address !== undefined) profile.address = dto.address ?? null;
    profile.updatedBy = this.em.getReference(UserEntity, userId);
    await this.em.flush();
    return this.toDto(profile);
  }
}
