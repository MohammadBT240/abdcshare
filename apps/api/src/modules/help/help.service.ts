import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/postgresql';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import type {
  CreateHelpCategoryDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import { HelpCategoryResponseDto } from './presentation/dto/help-category.dto';

@Injectable()
export class HelpService {
  constructor(private readonly em: EntityManager) {}

  private toCategoryDto(c: HelpCategoryEntity): HelpCategoryResponseDto {
    return { id: c.id, name: c.name, slug: c.slug, order: c.order, icon: c.icon ?? null };
  }

  async createCategory(dto: CreateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    if (await this.em.findOne(HelpCategoryEntity, { slug: dto.slug })) {
      throw new ConflictException('A help category with this slug already exists');
    }
    const category = this.em.create(HelpCategoryEntity, {
      name: dto.name,
      slug: dto.slug,
      order: dto.order ?? 0,
      icon: dto.icon ?? null,
    });
    await this.em.persistAndFlush(category);
    return this.toCategoryDto(category);
  }

  async listCategoriesAdmin(): Promise<HelpCategoryResponseDto[]> {
    const rows = await this.em.find(HelpCategoryEntity, {}, { orderBy: { order: 'asc', name: 'asc' } });
    return rows.map((c) => this.toCategoryDto(c));
  }

  async updateCategory(id: string, dto: UpdateHelpCategoryDto): Promise<HelpCategoryResponseDto> {
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id });
    if (dto.slug != null && dto.slug !== category.slug) {
      if (await this.em.findOne(HelpCategoryEntity, { slug: dto.slug, id: { $ne: id } })) {
        throw new ConflictException('A help category with this slug already exists');
      }
      category.slug = dto.slug;
    }
    if (dto.name != null) category.name = dto.name;
    if (dto.order != null) category.order = dto.order;
    if (dto.icon !== undefined) category.icon = dto.icon ?? null;
    await this.em.flush();
    return this.toCategoryDto(category);
  }

  async deleteCategory(id: string): Promise<void> {
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id });
    await this.em.removeAndFlush(category);
  }
}
