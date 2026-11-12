import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, QueryOrder, type FilterQuery } from '@mikro-orm/postgresql';
import type { Paginated } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { LibraryCategoryEntity } from './infrastructure/persistence/library-category.entity';
import { slugify } from './library.constants';
import type {
  CreateLibraryCategoryDto,
  LibraryCategoryListQueryDto,
  LibraryCategoryResponseDto,
  UpdateLibraryCategoryDto,
} from './presentation/dto/library.dto';

/** Library category catalogue. Reads: library:view. Writes: catalogue:manage (Platform Admin). */
@Injectable()
export class LibraryCategoriesService {
  constructor(private readonly em: EntityManager) {}

  private toDto(c: LibraryCategoryEntity): LibraryCategoryResponseDto {
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description ?? null,
      sortOrder: c.sortOrder,
      isActive: c.isActive,
    };
  }

  private async find(id: string): Promise<LibraryCategoryEntity> {
    const row = await this.em.findOne(LibraryCategoryEntity, { id });
    if (!row) throw new NotFoundException('Library category not found');
    return row;
  }

  private async assertUnique(name: string, slug: string, exceptId?: string): Promise<void> {
    const notSelf = exceptId ? { id: { $ne: exceptId } } : {};
    if (await this.em.findOne(LibraryCategoryEntity, { name: { $ilike: name }, ...notSelf })) {
      throw new ConflictException('A library category with this name already exists');
    }
    if (await this.em.findOne(LibraryCategoryEntity, { slug, ...notSelf })) {
      throw new ConflictException('A library category with this slug already exists');
    }
  }

  async list(
    query: LibraryCategoryListQueryDto,
    canManage: boolean,
  ): Promise<Paginated<LibraryCategoryResponseDto>> {
    const { page, pageSize, limit, offset } = pageParams(query);
    const where: FilterQuery<LibraryCategoryEntity> = {};
    if (!(query.includeInactive && canManage)) where.isActive = true;
    const q = query.q?.trim();
    if (q) where.name = { $ilike: `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%` };
    const [rows, total] = await this.em.findAndCount(LibraryCategoryEntity, where, {
      orderBy: { sortOrder: QueryOrder.ASC, name: QueryOrder.ASC, id: QueryOrder.ASC },
      limit,
      offset,
    });
    return paginated(
      rows.map((r) => this.toDto(r)),
      total,
      page,
      pageSize,
    );
  }

  async create(dto: CreateLibraryCategoryDto): Promise<LibraryCategoryResponseDto> {
    const name = dto.name.trim();
    const slug = slugify(dto.slug?.trim() || name);
    if (!name || !slug) throw new BadRequestException('Name is required');
    await this.assertUnique(name, slug);
    const row = this.em.create(LibraryCategoryEntity, {
      name,
      slug,
      description: dto.description?.trim() || null,
      sortOrder: dto.sortOrder ?? 0,
      isActive: true,
    });
    await this.em.persistAndFlush(row);
    return this.toDto(row);
  }

  async update(id: string, dto: UpdateLibraryCategoryDto): Promise<LibraryCategoryResponseDto> {
    const row = await this.find(id);
    const name = dto.name !== undefined ? dto.name.trim() : row.name;
    const slug = dto.slug !== undefined ? slugify(dto.slug) : row.slug;
    if (!name || !slug) throw new BadRequestException('Name and slug cannot be empty');
    if (name !== row.name || slug !== row.slug) await this.assertUnique(name, slug, id);
    row.name = name;
    row.slug = slug;
    if (dto.description !== undefined) row.description = dto.description?.trim() || null;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    await this.em.flush();
    return this.toDto(row);
  }

  /** Deactivate hides the category from pickers/filters; its items stay put. */
  async setActive(id: string, isActive: boolean): Promise<LibraryCategoryResponseDto> {
    const row = await this.find(id);
    row.isActive = isActive;
    await this.em.flush();
    return this.toDto(row);
  }
}
