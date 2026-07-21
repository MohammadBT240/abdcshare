import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { EngagementTypeEntity } from './infrastructure/persistence/engagement-type.entity';
import { RequestClassEngagementTypeEntity } from './infrastructure/persistence/request-class-engagement-type.entity';
import { RequestClassEntity } from '../request-classes/infrastructure/persistence/request-class.entity';
import type {
  CreateEngagementTypeDto,
  EngagementTypeListQueryDto,
  UpdateEngagementTypeDto,
} from './presentation/dto/engagement-type.dto';
import { EngagementTypeResponseDto } from './presentation/dto/engagement-type.dto';

@Injectable()
export class EngagementTypesService {
  constructor(private readonly em: EntityManager) {}

  private async allowedRequestClassIds(engagementTypeId: number): Promise<number[]> {
    const links = await this.em.find(RequestClassEngagementTypeEntity, {
      engagementType: engagementTypeId,
    });
    return links.map((l) => l.requestClass.id).sort((a, b) => a - b);
  }

  private async toDto(et: EngagementTypeEntity): Promise<EngagementTypeResponseDto> {
    return {
      id: et.id,
      name: et.name,
      isActive: et.isActive,
      allowedRequestClassIds: await this.allowedRequestClassIds(et.id),
    };
  }

  async create(dto: CreateEngagementTypeDto): Promise<EngagementTypeResponseDto> {
    if (await this.em.findOne(EngagementTypeEntity, { name: dto.name })) {
      throw new ConflictException('An engagement type with this name already exists');
    }
    const et = this.em.create(EngagementTypeEntity, {
      name: dto.name,
      isActive: dto.isActive ?? true,
    });
    await this.em.persistAndFlush(et);
    return this.toDto(et);
  }

  async list(query: EngagementTypeListQueryDto): Promise<Paginated<EngagementTypeResponseDto>> {
    const where: Record<string, unknown> = {};
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    if (query.q) where.name = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      EngagementTypeEntity,
      where as FilterQuery<EngagementTypeEntity>,
      { orderBy: { name: 'asc', id: 'asc' }, limit, offset },
    );
    const data = await Promise.all(rows.map((et) => this.toDto(et)));
    return paginated(data, total, page, pageSize);
  }

  async getOne(id: number): Promise<EngagementTypeResponseDto> {
    const et = await this.em.findOne(EngagementTypeEntity, { id });
    if (!et) throw new NotFoundException('Engagement type not found');
    return this.toDto(et);
  }

  async update(id: number, dto: UpdateEngagementTypeDto): Promise<EngagementTypeResponseDto> {
    const et = await this.em.findOneOrFail(EngagementTypeEntity, { id });
    if (dto.name != null && dto.name !== et.name) {
      if (await this.em.findOne(EngagementTypeEntity, { name: dto.name, id: { $ne: id } })) {
        throw new ConflictException('An engagement type with this name already exists');
      }
      et.name = dto.name;
    }
    if (dto.isActive != null) et.isActive = dto.isActive;
    await this.em.flush();
    return this.toDto(et);
  }

  async deactivate(id: number): Promise<EngagementTypeResponseDto> {
    return this.update(id, { isActive: false });
  }

  /** Replace the allowed request-class set for a type. Empty array ⇒ all request classes allowed. */
  async setAllowedRequestClasses(id: number, requestClassIds: number[]): Promise<EngagementTypeResponseDto> {
    const et = await this.em.findOneOrFail(EngagementTypeEntity, { id });
    const unique = [...new Set(requestClassIds)];
    if (unique.length > 0) {
      const found = await this.em.count(RequestClassEntity, { id: { $in: unique } });
      if (found !== unique.length) throw new NotFoundException('One or more request classes not found');
    }
    const existing = await this.em.find(RequestClassEngagementTypeEntity, { engagementType: id });
    for (const link of existing) this.em.remove(link);
    for (const requestClassId of unique) {
      this.em.create(RequestClassEngagementTypeEntity, {
        engagementType: et,
        requestClass: this.em.getReference(RequestClassEntity, requestClassId),
      });
    }
    await this.em.flush();
    return this.toDto(et);
  }
}
