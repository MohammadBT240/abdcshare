import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, type FilterQuery, type RequiredEntityData } from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { LOOKUP_REGISTRY, type LookupConfig, type LookupRow } from './reference.registry';
import type { CreateLookupDto, LookupListQueryDto, UpdateLookupDto } from './presentation/dto/lookup.dto';

@Injectable()
export class ReferenceService {
  constructor(private readonly em: EntityManager) {}

  private cfg(type: string): LookupConfig {
    const cfg = LOOKUP_REGISTRY[type];
    if (!cfg) throw new NotFoundException(`Unknown reference type "${type}"`);
    return cfg;
  }

  async list(type: string, query: LookupListQueryDto): Promise<Paginated<LookupRow>> {
    const cfg = this.cfg(type);
    const where: Record<string, unknown> = {};
    if (cfg.parent && query.parentId != null) where[cfg.parent.field] = query.parentId;

    let rows = (await this.em.find(cfg.entity, where as FilterQuery<LookupRow>)) as LookupRow[];
    if (query.q) {
      const q = query.q.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name));
    const { page, pageSize, offset, limit } = pageParams(query);
    return paginated(rows.slice(offset, offset + limit), rows.length, page, pageSize);
  }

  async create(type: string, dto: CreateLookupDto): Promise<LookupRow> {
    const cfg = this.cfg(type);
    const data: Record<string, unknown> = { name: dto.name };
    if (dto.isActive != null) data.isActive = dto.isActive;
    if (cfg.parent) {
      if (dto.parentId == null) throw new BadRequestException(`"${type}" requires a parentId`);
      data[cfg.parent.field] = this.em.getReference(cfg.parent.entity, dto.parentId);
    }
    const row = this.em.create(cfg.entity, data as unknown as RequiredEntityData<LookupRow>);
    await this.em.persistAndFlush(row);
    return row as LookupRow;
  }

  async update(type: string, id: number, dto: UpdateLookupDto): Promise<LookupRow> {
    const cfg = this.cfg(type);
    const row = (await this.em.findOneOrFail(cfg.entity, { id } as FilterQuery<LookupRow>)) as LookupRow;
    if (dto.name != null) row.name = dto.name;
    if (dto.isActive != null) row.isActive = dto.isActive;
    if (cfg.parent && dto.parentId != null) {
      (row as unknown as Record<string, unknown>)[cfg.parent.field] = this.em.getReference(cfg.parent.entity, dto.parentId);
    }
    await this.em.flush();
    return row;
  }
}
