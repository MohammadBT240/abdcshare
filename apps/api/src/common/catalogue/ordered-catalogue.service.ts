import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  EntityManager,
  type EntityName,
  type FilterQuery,
  type RequiredEntityData,
} from '@mikro-orm/postgresql';
import { type Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../pagination/paginate';

/** Common shape for simple ordered catalogues (stages, statuses). */
export interface OrderedRow {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface OrderedCreateDto {
  name: string;
  sortOrder?: number;
  isActive?: boolean;
}
export interface OrderedUpdateDto {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
}
export interface OrderedListQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: string;
}

/**
 * Base CRUD for `{ id, name, sortOrder, isActive }` catalogues. Mirrors the
 * reference-data approach: `em.find` is called WITHOUT typed find-options (which
 * require a concrete entity for `AutoPath`), then rows are sorted/paginated in
 * memory. Casts are confined to the EntityManager boundary.
 */
export abstract class OrderedCatalogueService<T extends OrderedRow> {
  protected constructor(
    protected readonly em: EntityManager,
    private readonly entity: EntityName<T>,
    private readonly label: string,
  ) {}

  async create(dto: OrderedCreateDto): Promise<OrderedRow> {
    if (await this.em.findOne(this.entity, { name: dto.name } as FilterQuery<T>)) {
      throw new ConflictException(`A ${this.label} with this name already exists`);
    }
    const data: Record<string, unknown> = {
      name: dto.name,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
    };
    const row = this.em.create(this.entity, data as unknown as RequiredEntityData<T>);
    await this.em.persistAndFlush(row);
    return row as unknown as OrderedRow;
  }

  async list(query: OrderedListQuery): Promise<Paginated<OrderedRow>> {
    const where: Record<string, unknown> = {};
    if (query.isActive != null) where.isActive = query.isActive === 'true';
    let rows = (await this.em.find(this.entity, where as FilterQuery<T>)) as unknown as OrderedRow[];
    if (query.q) {
      const q = query.q.toLowerCase();
      rows = rows.filter((r) => r.name.toLowerCase().includes(q));
    }
    rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    const { page, pageSize, offset, limit } = pageParams({
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
    return paginated(rows.slice(offset, offset + limit), rows.length, page, pageSize);
  }

  async getOne(id: number): Promise<OrderedRow> {
    const row = await this.em.findOne(this.entity, { id } as FilterQuery<T>);
    if (!row) throw new NotFoundException(`${this.label} not found`);
    return row as unknown as OrderedRow;
  }

  async update(id: number, dto: OrderedUpdateDto): Promise<OrderedRow> {
    const row = (await this.em.findOneOrFail(this.entity, { id } as FilterQuery<T>)) as unknown as OrderedRow;
    if (dto.name != null && dto.name !== row.name) {
      const clash = await this.em.findOne(this.entity, {
        name: dto.name,
        id: { $ne: id },
      } as FilterQuery<T>);
      if (clash) throw new ConflictException(`A ${this.label} with this name already exists`);
      row.name = dto.name;
    }
    if (dto.sortOrder != null) row.sortOrder = dto.sortOrder;
    if (dto.isActive != null) row.isActive = dto.isActive;
    await this.em.flush();
    return row;
  }

  async deactivate(id: number): Promise<OrderedRow> {
    return this.update(id, { isActive: false });
  }
}
