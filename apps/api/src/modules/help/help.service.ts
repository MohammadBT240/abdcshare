import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, raw } from '@mikro-orm/postgresql';
import type { FilterQuery } from '@mikro-orm/postgresql';
import { hasPermission, type Paginated, type PartnerDesignation, type RoleName } from '@abdcshare/shared';
import { pageParams, paginated } from '../../common/pagination/paginate';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { HelpCategoryEntity } from './infrastructure/persistence/help-category.entity';
import { HelpArticleEntity } from './infrastructure/persistence/help-article.entity';
import type {
  CreateHelpCategoryDto,
  UpdateHelpCategoryDto,
} from './presentation/dto/help-category.dto';
import { HelpCategoryResponseDto } from './presentation/dto/help-category.dto';
import type {
  CreateHelpArticleDto,
  HelpArticleListQueryDto,
  UpdateHelpArticleDto,
} from './presentation/dto/help-article.dto';
import {
  HelpArticleResponseDto,
  HelpArticleSummaryDto,
  HelpCategoryWithArticlesDto,
} from './presentation/dto/help-article.dto';
import { UserEntity } from '../users/infrastructure/persistence/user.entity';

interface ViewerContext {
  role: RoleName;
  partnerDesignation?: PartnerDesignation | null;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class HelpService {
  constructor(
    private readonly em: EntityManager,
    @Inject(STORAGE) private readonly storage: StoragePort,
  ) {}

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
    // The FK has no ON DELETE rule, so a category that still has articles would raise a
    // raw constraint violation (a 500) instead of a meaningful client error.
    const articleCount = await this.em.count(HelpArticleEntity, { category: id });
    if (articleCount > 0) {
      throw new ConflictException(
        'Move or delete the articles in this category before deleting it',
      );
    }
    await this.em.removeAndFlush(category);
  }

  private canManage(viewer: ViewerContext): boolean {
    return hasPermission(viewer.role, 'help:manage', viewer.partnerDesignation);
  }

  private isVisibleTo(article: HelpArticleEntity, viewer: ViewerContext): boolean {
    if (article.visibleToRoles.length === 0) return true;
    return article.visibleToRoles.includes(viewer.role);
  }

  /**
   * SQL equivalent of {@link isVisibleTo}, so role filtering happens in the database
   * (before any LIMIT) rather than in memory afterwards.
   *
   * `visible_to_roles` is a `jsonb` column, not a native Postgres array, so MikroORM's
   * array operators (`$contains` and friends) don't apply — this needs a raw fragment
   * using the jsonb containment operator plus an emptiness check ("empty = everyone").
   */
  private visibleToRolesWhere(viewer: ViewerContext): Record<string, unknown> {
    return {
      [raw(
        (alias) =>
          `(jsonb_array_length(${alias}.visible_to_roles) = 0 or ${alias}.visible_to_roles @> ?::jsonb)`,
        [JSON.stringify([viewer.role])],
      )]: true,
    };
  }

  private async toArticleDto(a: HelpArticleEntity): Promise<HelpArticleResponseDto> {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      bodyJson: (await this.resolveImageUrls(a.bodyJson)) as Record<string, unknown>,
      visibleToRoles: a.visibleToRoles,
      status: a.status,
      order: a.order,
      updatedAt: a.updatedAt,
      publishedAt: a.publishedAt ?? null,
    };
  }

  async uploadImage(dto: { fileName: string; contentType: string; data: string }): Promise<{ storageKey: string }> {
    if (!IMAGE_TYPES.has(dto.contentType)) {
      throw new BadRequestException('Use a JPEG, PNG, or WebP image');
    }
    const body = Buffer.from(dto.data.replace(/^data:[^;]+;base64,/, ''), 'base64');
    if (!body.length) throw new BadRequestException('Image data is empty');
    if (body.length > MAX_IMAGE_BYTES) throw new BadRequestException('Image must be 5 MB or smaller');

    return this.storage.upload({
      keyPrefix: 'help-images',
      fileName: dto.fileName,
      contentType: dto.contentType,
      body,
    });
  }

  /** Walk a Tiptap/ProseMirror JSON doc, replacing image `storageKey` attrs with fresh presigned URLs. */
  private async resolveImageUrls(node: unknown): Promise<unknown> {
    if (Array.isArray(node)) {
      return Promise.all(node.map((n) => this.resolveImageUrls(n)));
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if (obj.type === 'image' && obj.attrs && typeof obj.attrs === 'object') {
        const attrs = obj.attrs as Record<string, unknown>;
        const storageKey = attrs.storageKey;
        if (typeof storageKey === 'string' && storageKey) {
          return { ...obj, attrs: { ...attrs, src: await this.storage.presignDownload(storageKey) } };
        }
      }
      if (obj.content) {
        return { ...obj, content: await this.resolveImageUrls(obj.content) };
      }
    }
    return node;
  }

  private toSummaryDto(a: HelpArticleEntity): HelpArticleSummaryDto {
    return {
      id: a.id,
      categoryId: a.category.id,
      title: a.title,
      slug: a.slug,
      status: a.status,
      order: a.order,
    };
  }

  async createArticle(dto: CreateHelpArticleDto, actorId: string): Promise<HelpArticleResponseDto> {
    if (await this.em.findOne(HelpArticleEntity, { slug: dto.slug })) {
      throw new ConflictException('A help article with this slug already exists');
    }
    const category = await this.em.findOneOrFail(HelpCategoryEntity, { id: dto.categoryId });
    const article = this.em.create(HelpArticleEntity, {
      category,
      title: dto.title,
      slug: dto.slug,
      bodyJson: dto.bodyJson,
      bodyText: dto.bodyText,
      visibleToRoles: dto.visibleToRoles ?? [],
      order: dto.order ?? 0,
      createdBy: this.em.getReference(UserEntity, actorId),
    });
    await this.em.persistAndFlush(article);
    return this.toArticleDto(article);
  }

  async updateArticle(id: string, dto: UpdateHelpArticleDto): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    if (dto.slug != null && dto.slug !== article.slug) {
      if (await this.em.findOne(HelpArticleEntity, { slug: dto.slug, id: { $ne: id } })) {
        throw new ConflictException('A help article with this slug already exists');
      }
      article.slug = dto.slug;
    }
    if (dto.categoryId != null) {
      article.category = await this.em.findOneOrFail(HelpCategoryEntity, { id: dto.categoryId });
    }
    if (dto.title != null) article.title = dto.title;
    if (dto.bodyJson != null) article.bodyJson = dto.bodyJson;
    if (dto.bodyText != null) article.bodyText = dto.bodyText;
    if (dto.visibleToRoles != null) article.visibleToRoles = dto.visibleToRoles;
    if (dto.order != null) article.order = dto.order;
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async publishArticle(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    article.status = 'published';
    article.publishedAt = new Date();
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async unpublishArticle(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id }, { populate: ['category'] });
    article.status = 'draft';
    await this.em.flush();
    return this.toArticleDto(article);
  }

  async deleteArticle(id: string): Promise<void> {
    const article = await this.em.findOneOrFail(HelpArticleEntity, { id });
    await this.em.removeAndFlush(article);
  }

  async listArticlesAdmin(query: HelpArticleListQueryDto): Promise<Paginated<HelpArticleSummaryDto>> {
    const where: Record<string, unknown> = {};
    if (query.categoryId) where.category = query.categoryId;
    if (query.status) where.status = query.status;
    if (query.q) where.title = { $ilike: `%${query.q}%` };

    const { page, pageSize, limit, offset } = pageParams(query);
    const [rows, total] = await this.em.findAndCount(
      HelpArticleEntity,
      where as FilterQuery<HelpArticleEntity>,
      { populate: ['category'], orderBy: { order: 'asc', title: 'asc' }, limit, offset },
    );
    return paginated(rows.map((a) => this.toSummaryDto(a)), total, page, pageSize);
  }

  /** Authoring-only fetch by id — no status/role filtering, the route is `help:manage` guarded. */
  async getArticleByIdAdmin(id: string): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOne(HelpArticleEntity, { id }, { populate: ['category'] });
    if (!article) throw new NotFoundException('Help article not found');
    return this.toArticleDto(article);
  }

  async getCategoriesForViewer(viewer: ViewerContext): Promise<HelpCategoryWithArticlesDto[]> {
    const categories = await this.em.find(HelpCategoryEntity, {}, { orderBy: { order: 'asc', name: 'asc' } });
    const articles = await this.em.find(
      HelpArticleEntity,
      { status: 'published' },
      { populate: ['category'], orderBy: { order: 'asc', title: 'asc' } },
    );
    const visible = articles.filter((a) => this.isVisibleTo(a, viewer));
    return categories
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        order: c.order,
        icon: c.icon ?? null,
        articles: visible.filter((a) => a.category.id === c.id).map((a) => this.toSummaryDto(a)),
      }))
      // A category with nothing the viewer may read is noise (and a small hint that
      // role-scoped content exists) — drop it rather than render an empty accordion row.
      .filter((c) => c.articles.length > 0);
  }

  async getArticleBySlug(slug: string, viewer: ViewerContext): Promise<HelpArticleResponseDto> {
    const article = await this.em.findOne(HelpArticleEntity, { slug }, { populate: ['category'] });
    if (!article) throw new NotFoundException('Help article not found');
    const manage = this.canManage(viewer);
    if (!manage && article.status !== 'published') throw new NotFoundException('Help article not found');
    if (!manage && !this.isVisibleTo(article, viewer)) throw new NotFoundException('Help article not found');
    return this.toArticleDto(article);
  }

  async searchArticles(q: string, viewer: ViewerContext): Promise<HelpArticleSummaryDto[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];
    const term = `%${trimmed}%`;
    const rows = await this.em.find(
      HelpArticleEntity,
      {
        status: 'published',
        $or: [{ title: { $ilike: term } }, { bodyText: { $ilike: term } }],
        ...this.visibleToRolesWhere(viewer),
      } as FilterQuery<HelpArticleEntity>,
      { populate: ['category'], orderBy: { title: 'asc' }, limit: 20 },
    );
    return rows.map((a) => this.toSummaryDto(a));
  }
}
